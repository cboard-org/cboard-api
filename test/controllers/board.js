//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
const chai = require('chai');
var request = require('supertest');
const { check } = require("prettier");
var expect = require('chai').expect;
const should = chai.should();

const server = require('../../app');
const helper = require('../helper');
const { token } = require('morgan');


//Parent block
describe('Board API calls', function () {

  var authToken;

  before((done) => { //Before all we empty the database
    helper.prepareUser(server)
      .then(token => {
        authToken = token;
        done();
      });
  });

  it('it should POST a board', function (done) {
    request(server)
      .post('/board')
      .send(helper.boardData)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        // Verify response
        helper.verifyBoardProperties(res.body);
        done();
      });
  });

  it('it should GET all the boards', function (done) {
    request(server)
      .get('/board')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        // Verify response
        helper.verifyListProperties(res.body);
        done();
      });
  });
});