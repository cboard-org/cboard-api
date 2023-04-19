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
        .get('/gpt/edit')
        .send(toEditData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should return error if phrase is not completed.', async function() {
      const res = await request(server)
        .get('/gpt/edit')
        .send({})
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400);
    });

    it('it should improve provided phrase and return it.', async function() {
      const mockedOpenAPIResponse = {
        id: 'cmpl-75m1j4HRnQklZItaVxiLz5Zc4Ig9X',
        object: 'text_completion',
        created: 1681610611,
        model: 'text-davinci-003',
        choices: [
          {
            text: '\n\nWhat do you think?',
            index: 0,
            logprobs: null,
            finish_reason: 'length'
          }
        ],
        usage: { prompt_tokens: 24, completion_tokens: 7, total_tokens: 31 }
      };

      nock('https://api.openai.com')
        .post('/v1/completions')
        .reply(200, mockedOpenAPIResponse);

      const res = await request(server)
        .get('/gpt/edit')
        .send(toEditData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
      nock.isDone().should.to.deep.equal(true);

      res.body.should.be.a('object');

      res.body.phrase.should.be.equal(mockedOpenAPIResponse.choices[0].text);
    });
  });
});
