process.env.NODE_ENV = 'test';

const request = require('supertest');
const chai = require('chai');

const server = require('../../app');
const helper = require('../helper');

//Parent block
describe('Translate API calls', function () {
  this.timeout(7000); //some external process take time. We should stumb procces to remove this.
  let user;

  before(async function () {
    await helper.deleteMochaUser();
    user = await helper.prepareUser(server, {
      role: 'user',
      email: helper.userData.email,
    });
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
