const request = require('supertest');
const chai = require('chai');

const server = require('../../app');
const helper = require('../helper');

//Parent block
describe('analytics API calls', function () {
  let authToken;
  let userid;

  before(async function (done) {
    this.timeout(5000); //to await the email server process
    helper.prepareUser(server).then((token, userId) => {
      authToken = token;
      userid = userId;
      done();
    });
  });

  it('it should NOT return analytics User data without bearer.', function (done) {
    //this.timeout(5000); //to set timeout from 2s to 5s because the email server process take time.
    request(server)
      .post('/analytics/batchGet')
      .set('Accept', 'application/json')
      .send(helper.analyticsReportData)
      .expect('Content-Type', /json/)
      .expect(403)
      .end(function (err, res) {
        if (err) done(err);
        done();
      });
  });

  it('it should return analytics User Activity data.', function (done) {
    this.timeout(4000) //to give time for google analitics process
    request(server)
      .post('/analytics/batchGet')
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .send(helper.analyticsReportData)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        const analyticsReport = res.body.reports;
        analyticsReport.should.be.a('array');
        done();
      });
  });

  it('it should return analytics User Activity data.', function (done) { //this endpoint has not developed yet 
    //this.timeout(4000) //to give time for google analitics process
    request(server)
      .post('/analytics/userActivity/' + userid)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        done();
      });
  });

});  