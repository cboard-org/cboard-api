process.env.NODE_ENV = 'test';

const request = require('supertest');
const helper = require('../helper');
const nock = require('nock');

//Parent block
describe('GPT API calls', function() {
  let user;
  let server;

  before(async function() {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
    helper.userData.email = helper.generateEmail();
    user = await helper.prepareUser(server, {
      role: 'user',
      email: helper.userData.email
    });
  });

  after(async function() {
    helper.prepareNodemailerMock(true); //disable mockery
    await helper.deleteMochaUsers();
  });

  describe('GET /gpt/edit', function() {
    const toEditData = helper.gpt.toEditData;

    it('it should return error if user is not logged.', async function() {
      const res = await request(server)
        .post('/gpt/edit')
        .send(toEditData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should return error if phrase is not completed.', async function() {
      const res = await request(server)
        .post('/gpt/edit')
        .send({})
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400);
    });

    it('it should improve provided phrase and return it.', async function() {
      const mockedOpenAPIResponse = {
        id: 'chatcmpl-8F8QzJKqVpNQ1',
        object: 'chat.completion',
        created: 1699484965,
        model: 'gpt-4.1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'What do you think?'
            },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 24, completion_tokens: 7, total_tokens: 31 }
      };

      nock('https://cboard-openai.cognitiveservices.azure.com')
        .post('/openai/deployments/gpt-4.1/chat/completions?api-version=2024-02-01')
        .reply(200, mockedOpenAPIResponse);

      const res = await request(server)
        .post('/gpt/edit')
        .send(toEditData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
      nock.isDone().should.to.deep.equal(true);

      res.body.should.be.a('object');

      res.body.phrase.should.be.equal(mockedOpenAPIResponse.choices[0].message.content);
    });
  });
});
