//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
const chai = require('chai');
var request = require('supertest');
var expect = require('chai').expect;
const should = chai.should();

const server = require('../../app');
const helper = require('../helper');

const Board = require('../../api/models/Board');

//Parent block
describe('Board API calls', function () {

  var authToken;
  var boardId;

  before(async function() {
    const res = await helper.prepareUser(server);
    authToken = res.token;
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

  it('it should NOT PUT a board without ID', function (done) {
    const boardData = { ...helper.boardData };
    request(server)
      .put('/board')
      .send(boardData)
      .set('Authorization', 'Bearer ' + authToken)
      .expect(405)
      .end(function (err, res) {
        if (err) return done(err);
        done();
      });
  });

  it('it should NOT PUT a board without authorization', function (done) {
    request(server)
      .put('/board/' + boardId)
      .send(helper.boardData)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(403)
      .end(function (err, res) {
        if (err) return done(err);
        done();
      });
  });

  it('it should GET a board', function (done) {
    const boardData = { ...helper.boardData };
    request(server)
      .get('/board/' + boardId)
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

  it('it should GET a board without authorization', function (done) {
    request(server)
      .get('/board/' + boardId)
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

  it('it should NOT DELETE a board without authorization', function (done) {
    request(server)
      .del('/board/' + boardId)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(403)
      .end(function (err, res) {
        if (err) return done(err);
        done();
      });
  });

  it('it should NOT DELETE a board without id', function (done) {
    request(server)
      .del('/board/')
      .set('Accept', 'application/json')
      .expect(405)
      .end(function (err, res) {
        if (err) return done(err);
        done();
      });
  });

  it('it should delete a board', function (done) {
    const boardData = { ...helper.boardData };
    request(server)
      .del('/board/' + boardId)
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

  it('it should NOT DELETE a board that was already removed ', function (done) {
    request(server)
    .del('/board/' + boardId)
    .set('Authorization', 'Bearer ' + authToken)
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
      .expect(404)
      .end(function (err, res) {
        if (err) return done(err);
        done();
      });
  });

  describe('GET /board/byemail/:email', function() {
    it("only allows an admin to get another user's boards", async function() {
      const adminEmail = helper.generateEmail();
      const admin = await helper.prepareUser(server, {
        role: 'admin',
        email: adminEmail,
      });

      const userEmail = helper.generateEmail();
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: userEmail,
      });

      // Try to get another user's boards as a regular user.
      // This should fail.
      await request(server)
        .get(`/board/byemail/${encodeURI(adminEmail)}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect({
          message: "You are not authorized to get this user's boards.",
        })
        .expect(403);

      // Try to get another user's boards as an admin user.
      // This should succeed.
      await request(server)
        .get(`/board/byemail/${encodeURI(userEmail)}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);


      // Try to get my own boards as a regular user.
      // This should succeed.
      await request(server)
        .get(`/board/byemail/${encodeURI(userEmail)}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
    });
  });
});