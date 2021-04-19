const request = require('supertest');
const chai = require('chai');

const User = require('../../api/models/User');

const helper = require('../helper');

//Parent block
describe('analytics API calls', function () {
  let server;
  let user;

  before(async function () {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
  });

  after(async function () {
    helper.prepareNodemailerMock(true);
    await User.deleteMany({ name: 'cboard mocha test' });
  });

  describe('POST /analytics/batchGet', function () {
    before(async function(){
      user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
    })

    it('it should NOT return analytics User data without bearer.', async function () {
      await request(server)
        .post('/analytics/batchGet')
        .set('Accept', 'application/json')
        .send(helper.analyticsReportData)
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should return analytics User Activity data.', async function () {
      const res = await request(server)
        .post('/analytics/batchGet')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .send(helper.analyticsReportData)
        .expect('Content-Type', /json/)
        .expect(200);

      const analyticsReport = res.body.reports;
      analyticsReport.should.be.a('array');
    });
  });

  describe('POST /analytics/userActivity/:userid', function () {
    it('it should return analytics User Activity data.', async function () {
      //this endpoint has not developed yet
      await request(server)
        .post(`/analytics/userActivity/${user.userId}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    });
  });
});
