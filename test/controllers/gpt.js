process.env.NODE_ENV = 'test';

const request = require('supertest');
const helper = require('../helper');

//Parent block
describe('GPT API calls', function () {
  let user;
  let server;

  before(async function () {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
    helper.userData.email = helper.generateEmail();
    user = await helper.prepareUser(server, {
      role: 'user',
      email: helper.userData.email,
    });
  });

  after(async function () {
    helper.prepareNodemailerMock(true); //disable mockery
    await helper.deleteMochaUsers();
  });

  describe('GET /gpt/edit', function () {
    it('it should return error if phrase is not completed.', async function () {
        const res = await request(server)
          .get('/gpt/edit')
          .send({})
          .set('Authorization', `Bearer ${user.token}`)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(400);
      });

    it('it should improve provided phrase and return it.', async function () {
      const res = await request(server)
        .get('/gpt/edit')
        .send(helper.gpt.toEditData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.be.a('object');
    });
  });
});