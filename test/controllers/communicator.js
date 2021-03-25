const request = require('supertest');
const chai = require('chai');

const server = require('../../app');
const helper = require('../helper');

//Parent block
describe('Communicator API calls', function () {
  let authToken;
  let url;
  let communicatorid;

  before(async function (done) {
    this.timeout(5000); //to await the email server process
    helper.prepareUser(server).then((token) => {
      authToken = token;
      done();
    });
  });

  it('it should to create a new communicator', function (done) {
    this.timeout(5000); //to set timeout from 2s to 5s because the email server process take time.
    request(server)
      .post('/communicator')
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .send(helper.communicatorData)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        const communicatorRes = res.body;
        communicatorRes.should.to.have.all.keys(
          'success',
          'id',
          'communicator',
          'message'
        );
        communicatorid = communicatorRes.id;
        communicatorid.should.be.a('string');
        done();
      });
  });

  it('it should to get the full communicator list', function (done) {
    request(server)
      .get('/communicator')
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        helper.verifyListProperties(res.body);
        done();
      });
  });

  it('it should to NOT get specific communicator without auth', function (done) {
    request(server)
      .get('/communicator/' + communicatorid)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(403)
      .end(function (err, res) {
        if (err) done(err);
        done();
      });
  });

  it('it should to get specific communicator', function (done) {
    request(server)
      .get('/communicator/' + communicatorid)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        helper.verifyCommunicatorProperties(res.body);
        done();
      });
  });

  it('it should NOT update communicator without auth', function (done) {
    request(server)
      .put('/communicator/' + communicatorid)
      .set('Accept', 'application/json')
      .send(helper.communicatorData)
      .expect('Content-Type', /json/)
      .expect(403)
      .end(function (err, res) {
        if (err) done(err);
        done();
      });
  });

  it('it should update communicator', function (done) {
    const newCommunicatorData = { ...helper.communicatorData };
    newCommunicatorData.name = 'mocha update';
    request(server)
      .put('/communicator/' + communicatorid)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .send(newCommunicatorData)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        helper.verifyCommunicatorProperties(res.body);
        done();
      });
  });

  it('it should NOT get communicators for a specific user email without auth', function (done) {
    request(server)
      .get('/communicator/byemail/' + helper.communicatorData.email)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(403)
      .end(function (err, res) {
        if (err) done(err);
        done();
      });
  });

  it('it should get communicators for a specific user email', function (done) {
    request(server)
      .get('/communicator/byemail/' + helper.communicatorData.email)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        helper.verifyListProperties(res.body);
        done();
      });
  });

  it('it should NOT delete specific communicator without auth', function (done) {
    helper.adminRoleToMochaUser(server, authToken).then(() => {
      request(server)
        .del('/communicator/' + communicatorid)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403)
        .end(function (err, res) {
          if (err) done(err);
          done();
        });
    });
  });

  it('it should NOT delete specific communicator without id', function (done) {
    request(server)
      .del('/communicator/')
      .set('Accept', 'application/json')
      .expect(405)
      .end(function (err, res) {
        if (err) done(err);
        done();
      });
  });

  it('it should to delete specific communicator', function (done) {
    request(server)
      .del('/communicator/' + communicatorid)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        helper.verifyCommunicatorProperties(res.body);
        done();
      });
  });

  it('it should NOT DELETE a communicator that was already removed', function (done) {
    //this test is failling
    request(server)
      .del('/communicator/' + communicatorid)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .end(function (err, res) {
        if (err) done(err);
        done();
      });
  });
});
