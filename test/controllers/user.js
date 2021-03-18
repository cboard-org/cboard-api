process.env.NODE_ENV = 'test';

const request = require("supertest");
const chai = require ('chai');
var assert = chai.assert;

const server = require('../../app');
const helper = require('../helper');
const { copy } = require("../../app");

//Parent block
describe('User API calls', function () {
  let authToken;
  let url;
  let userid;
    before(async function (done) {
      // await Board.collection.drop();
      helper.deleteUser(server)
      .then(token => {
        authToken = token;
        done();
      });
    });
    
  it("it should to create a new temporary user",function(done) {
    this.timeout(5000); //to await the email server process
    request(server)
      .post('/user')
      .send(helper.userData)
      .expect(200)
      .expect(function (res) {
          url = res.body.url;
      })
      .end(function(err, res){
        if (err) done(err);
        done();
      }); 
  })

  it("it should to activate user",function(done) {
    this.timeout(5000);
    request(server)
    .post('/user/activate/' + url)
    .send('')
    .expect(200)
    .expect(function (res) {
      userid = res.body.userid;
    })
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  })

  it("it should NOT Returns a valid token for a wrong email or password", function(done) {
    const badUserData = { ...helper.userData };
    badUserData.password = 'badPassword';
    request(server)
      .post('/user/login')
      .send(badUserData)
      .expect(401)
      .expect(function (res) {
        authToken = res.body.authToken;
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

  it("it should Get a specific user", function(done) {
    request(server)
      .get('/user/' + userid)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  it("it should update a specific user", function(done) {
    request(server)
      .put('/user/' + userid)
      //.send(helper.userData)
      .send({role: "admin"})
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