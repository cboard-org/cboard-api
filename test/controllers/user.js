process.env.NODE_ENV = 'test';

const request = require('supertest');
const chai = require('chai');

const server = require('../../app');
const helper = require('../helper');

//Parent block
describe('User API calls', function () {
  let authToken;
  let url;
  let userid;

  before(async function (done) {
    helper.deleteMochaUser(server).then((token) => {
      authToken = token;
      done();
    });
  });

  it('it should to create a new temporary user', function (done) {
    this.timeout(5000); //to set timeout from 2s to 5s because the email server process take time.
    request(server)
      .post('/user')
      .send(helper.userData)
      .expect(200)
      .end(function (err, res) {
        const URLLenght = 16;
        if (err) done(err);
        url = res.body.url;
        url.should.be.a('string').with.lengthOf(URLLenght); //nev.options.URLLenght
        done();
      });
  });

  it('it should to activate user', function (done) {
    this.timeout(5000);
    request(server)
      .post('/user/activate/' + url)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        userid = res.body.userid;
        userid.should.be.a('string');
        userid.should.not.have.string(' '); //is not recomended negate assertions
        done();
      });
  });

  it('it should NOT Returns a valid token for a wrong email or password', function (done) {
    const wrongUserData = { ...helper.userData };
    wrongUserData.password = 'wrongPassword';
    request(server)
      .post('/user/login')
      .send(wrongUserData)
      .expect('Content-Type', /json/)
      .expect(401)
      .end(function (err, res) {
        if (err) done(err);
        authToken = res.body.authToken;
        (authToken === undefined).should.be.true;
        res.body.message.should.be.string;
        done();
      });
  });

  it('it should Returns a valid token for a user', function (done) {
    request(server)
      .post('/user/login')
      .send(helper.userData)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        authToken = res.body.authToken;
        authToken.should.be.a('string');
        authToken.should.not.have.string(' ');
        done();
      });
  });

  it('it should NOT Get the full users list without Bearer Token', function (done) {
    request(server)
      .get('/user')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(403)
      .end(function (err, res) {
        if (err) done(err);
        done();
      });
  });

  it('it should Get the full users list', function (done) {
    request(server)
      .get('/user')
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

  it('it should Get a specific user', function (done) {
    request(server)
      .get('/user/' + userid)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        const getUser = res.body;
        getUser.should.to.have.any.keys('name', 'role', 'provider', 'email');
        done();
      });
  });

  it('it should update a specific user', function (done) {
    request(server)
      .put('/user/' + userid)
      .send({ role: 'admin' })
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        const updateUser = res.body;
        updateUser.should.to.have.property('role').to.equal('admin');
        done();
      });
  });

  it('it should Destroys user session and authentication token', function (done) {
    request(server)
      .post('/user/logout')
      .send(helper.userData)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        res.body.message.should.be.string;
        done();
      });
  });

  it('it should NOT create a Clear token to auth for a wrong email', function (done) {
    let wrongUserEmail = { ...helper.userData };
    wrongUserEmail.email = 'wrong_email@wrong.com';
    request(server)
      .post('/user/forgot')
      .send(wrongUserEmail)
      .expect('Content-Type', /json/)
      .expect(404)
      .end(function (err, res) {
        if (err) done(err);
        res.body.message.should.be.a('string');
        done();
      });
  });

  it('it should create a Clear token to restore password', function (done) {
    this.timeout(5000); //to await the email server process
    request(server)
      .post('/user/forgot')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .send(helper.userData)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        const userAndToken = res.body;
        userAndToken.should.be.a('object').with.any.keys('userid', 'token');
        helper.userForgotPassword.userid = res.body.userid;
        helper.userForgotPassword.token = res.body.token;
        done();
      });
  });

  it('it should NOT allows to store a new password without a verification url.', function (done) {
    let wrongVerificationUrl = { ...helper.userForgotPassword };
    wrongVerificationUrl.token = '';
    request(server)
      .post('/user/store-password')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .send(wrongVerificationUrl)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        res.body.message.should.be.a('string');
        done();
      });
  });

  it('it should allows to store a new password using a verification url.', function (done) {
    request(server)
      .post('/user/store-password')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .send(helper.userForgotPassword)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        const storePasswordRes = res.body;
        storePasswordRes.should.to.have.all.keys('success', 'message');
        done();
      });
  });

  it('it should delete a user', function (done) {
    request(server)
      .del('/user/' + helper.userForgotPassword.userid)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        const userDeleted = res.body;
        userDeleted.should.to.have.any.keys('name', 'email', 'locale');
        done();
      });
  });
});
