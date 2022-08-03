//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

const request = require('supertest');
const helper = require('../helper');

describe("Find location of unlogged user", async function () {
  let server;
  let publicIp;

  before(async function () {
    try {
      publicIp = await helper.getPublicIp();
    } catch (e) {
      publicIp = '191.213.233.162';
    }
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
  });

  after(async function () {
    helper.prepareNodemailerMock(true);
    await helper.deleteMochaUsers();
  });

  describe('GET /location', function () {
    it('It should retrieve the unlogged user location.', async function () {
      const res = await request(server)
        .get('/location')
        .set('X-Forwarded-For', publicIp)
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.be.a('object');
    });
  });
})