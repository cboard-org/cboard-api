process.env.NODE_ENV = 'test';

const request = require('supertest');
const chai = require('chai');

const helper = require('../helper');

//Parent block
describe('Translate API calls', function () {
  let user;
  let server;

  before(async function () {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
    helper.userData.email = helper.generateEmail();
    user = await helper.prepareUser(server, {
      role: 'user',
      email: helper.userData.email
    });
  });

  after(async function () {
    helper.prepareNodemailerMock(true); //disable mockery
    helper.deleteMochaUsers();
  });

  describe('POST /translate', function () {
    it('it should creates or updates a user s settings object in database.', async function () {
      const res = await request(server)
        .post('/translate')
        .send(helper.translateData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.be.a('object');
    });
  });
});
