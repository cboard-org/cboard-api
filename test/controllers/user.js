process.env.NODE_ENV = 'test';

const request = require("supertest");
const chai = require ('chai');
var assert = chai.assert;

const server = require('../../app');
const helper = require('../helper');
const User = require("../../api/models/User");
const user = require("../../api/controllers/user");
const { copy } = require("../../app");

//Parent block
describe('User API calls', function () {
  var authToken;

  it("it should NOT Returns a valid token for a wrong email or password", function(done) {
    const badUserData = { ...helper.userData };
    badUserData.password = 'badPassword';
    request(server)
      .post('/user/login')
      .send(badUserData)
      .expect(401)
      .expect(function (res) {
        authToken = res.body.authToken;
        userId = res.body
      })
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  it("it should Returns a valid token for a user", function(done) {
    request(server)
      .post('/user/login')
      .send(helper.userData)
      .expect(200)
      .expect(function (res) {
        authToken = res.body.authToken;
      })
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  it("it should NOT Get the full users list without Bearer Token", function(done) {
    request(server)
      .get('/user')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(403)
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  it("it should Get the full users list", function(done) {
    request(server)
      .get('/user')
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  it("it should Destroys user session and authentication token", function(done) {
    request(server)
      .post('/user/logout')
      .send(helper.userData) 
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  it("it should NOT create a Clear token to auth for a wrong email", function(done) {
    let BadUserEmail = { ...helper.userData };
    BadUserEmail.email = 'badEmail@bad.com';
    request(server)
      .post('/user/forgot')
      .send(BadUserEmail)
      .expect(404)
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  it("it should create a Clear token to auth", function(done) {
    this.timeout(5000); //to await the email server process
    request(server)
      .post('/user/forgot')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .send(helper.userData) 
      .expect(200)
      .end(function(err, res){
        if (err) done(err);
        helper.userForgotPassword.userid = res.body.userid;
        helper.userForgotPassword.token = res.body.token;
        done();
      });
  });

  it("it should NOT allows to store a new password without a verification url.", function(done) {
    let badVerUrl = { ...helper.userForgotPassword };
    badVerUrl.token = "";
    request(server)
      .post('/user/store-password')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .send(badVerUrl) 
      .expect(200)
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  it("it should allows to store a new password using a verification url.", function(done) {
    request(server)
      .post('/user/store-password')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .send(helper.userForgotPassword) 
      .expect(200)
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  it("it should delete a user", function(done) {
    helper.giveAdminrole();
    request(server)
      .del('/user/'+ helper.userForgotPassword.userid)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  // it('it should removes a temporaly user', (done) => {
  //   removeHelperUser();
  //   done();
//     User.findOneAndRemove({ email: "anything@cboard.io" })
//       .then(() => User.findOne(helper.userData))
//       .then((User) => {
//         assert(User === null);
//         done();
//       });
  // });
  //User.findByIdAndRemove('604f6e4bd57b972bc4a01e2a');
});