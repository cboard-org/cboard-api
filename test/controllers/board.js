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

const Board = require('../../api/models/Board');

//Parent block
describe('Board API calls', function () {

  var authToken;
  var boardId;

  before(async function (done) { //Before all we empty the database
    await Board.collection.drop();
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
        boardId = res.body.id;
        done();
      });
  });

  it('it should POST an empty board', function (done) {
    const emptyBoard = { ...helper.boardData };
    delete emptyBoard.tiles;
    request(server)
      .post('/board')
      .send(emptyBoard)
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

  it('it should NOT POST a board without name', function (done) {
    const boardData = { ...helper.boardData };
    delete boardData.name;
    request(server)
      .post('/board')
      .send(boardData)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(409)
      .end(function (err, res) {
        if (err) return done(err);
        done();
      });
  });

  it('it should NOT POST a board without authorization', function (done) {
    request(server)
      .post('/board')
      .send(helper.boardData)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(403)
      .end(function (err, res) {
        if (err) return done(err);
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

  it('it should PUT a board', function (done) {
    const boardData = { ...helper.boardData };
    boardData.name = 'edited name';
    request(server)
      .put('/board/' + boardId)
      .send(boardData)
      .set('Authorization', 'Bearer ' + authToken)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        // Verify response
        helper.verifyBoardProperties(res.body);
        res.body.name.should.to.equal(boardData.name);
        done();
      });
  });
});