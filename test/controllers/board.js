//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
const chai = require('chai');
var request = require('supertest');
var expect = require('chai').expect;
const should = chai.should();
const helper = require('../helper');

const Board = require('../../api/models/Board');

//Parent block
describe('Board API calls', function () {
  let user;
  let server;

  before(async function () {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
  });

  beforeEach(async function () {
    helper.boardData.email = helper.generateEmail();
    user = await helper.prepareUser(server, {
      role: 'user',
      email: helper.boardData.email,
    });
  });

  after(async function () {
    helper.prepareNodemailerMock(true); //disable mockery
    helper.deleteMochaUsers();
    await Board.deleteMany({ author: 'cboard mocha test' });
  });

  describe('POST /board', function () {
    it('it should POST a board', async function () {
      const res = await request(server)
        .post('/board')
        .send(helper.boardData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
    });

    it('it should POST an empty board', async function () {
      const emptyBoard = { ...helper.boardData };
      delete emptyBoard.tiles;
      const res = await request(server)
        .post('/board')
        .send(emptyBoard)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
      helper.verifyBoardProperties(res.body);
    });

    it('it should NOT POST a board without name', async function () {
      const boardData = { ...helper.boardData };
      delete boardData.name;
      await request(server)
        .post('/board')
        .send(boardData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(409);
    });

    it('it should NOT POST a board without authorization', async function () {
      await request(server)
        .post('/board')
        .send(helper.boardData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('GET /board', function () {
    it('it should GET all the boards', async function () {
      const res = await request(server)
        .get('/board')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyListProperties(res.body);
    });
  });

  describe('PUT /board/:boardid', function () {
    before(async function () {
      this.boardId = await helper.createMochaBoard(server, user.token);
    });

    it('it should PUT a board', async function () {
      const boardData = { ...helper.boardData };
      boardData.name = 'edited name';
      const res = await request(server)
        .put('/board/' + this.boardId)
        .send(boardData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
    });

    it('it should NOT PUT a board without ID', async function () {
      const boardData = { ...helper.boardData };
      await request(server)
        .put('/board')
        .send(boardData)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(405);
    });

    it('it should NOT PUT a board without authorization', async function () {
      await request(server)
        .put('/board/' + this.boardId)
        .send(helper.boardData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('GET /board/:boardid', function () {
    before(async function () {
      this.boardId = await helper.createMochaBoard(server, user.token);
    });

    it('it should GET a board', async function () {
      const res = await request(server)
        .get('/board/' + this.boardId)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
    });

    it('it should GET a board without authorization', async function () {
      const res = await request(server)
        .get('/board/' + this.boardId)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
    });
  });

  describe('DELETE /board/:boardid', function () {
    before(async function () {
      this.boardId = await helper.createMochaBoard(server, user.token);
    });

    it('it should NOT DELETE a board without authorization', async function () {
      await request(server)
        .del('/board/' + this.boardId)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should NOT DELETE a board without id', async function () {
      await request(server)
        .del('/board/')
        .set('Accept', 'application/json')
        .expect(405);
    });

    it('it should delete a board', async function () {
      const res = await request(server)
        .del('/board/' + this.boardId)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
    });

    it('it should NOT DELETE a board that was already removed ', async function () {
      await request(server)
        .del('/board/' + this.boardId)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);
    });
  });
});
