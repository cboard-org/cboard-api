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
    await helper.deleteMochaUsers();
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

    it.skip("returns a 404 if the caller is not an admin and doesn't own the board", async function () {
      const email = helper.generateEmail();
      const user1 = await helper.prepareUser(server, { email });
      const user2 = await helper.prepareUser(server, {
        // The user is not an admin, so they should only be able
        // to delete their own boards.
        role: 'user',
        email: helper.generateEmail(),
      });

      const { body: { id: boardId } } = await request(server)
        .post('/board')
        .send({ ...helper.boardData, email })
        .set('Authorization', `Bearer ${user1.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      await request(server)
        .del(`/board/${boardId}`)
        .set('Authorization', `Bearer ${user2.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);
    });

    it.skip("deletes the board if the caller is an admin but doesn't own the board", async function () {
      const email = helper.generateEmail();
      const user1 = await helper.prepareUser(server, { email });
      const user2 = await helper.prepareUser(server, {
        // The user is an admin, so they should be able to delete
        // any board.
        role: 'admin',
        email: helper.generateEmail(),
      });

      const { body: { id: boardId } } = await request(server)
        .post('/board')
        .send({ ...helper.boardData, email })
        .set('Authorization', `Bearer ${user1.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      await request(server)
        .del(`/board/${boardId}`)
        .set('Authorization', `Bearer ${user2.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
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

  describe('GET /board/sync/:email', function () {
    // beforeEach (not before) so the board is created for the user set up by
    // the parent beforeEach, which runs first and regenerates the test email.
    beforeEach(async function () {
      this.boardId = await helper.createMochaBoard(server, user.token);
    });

    it('it should return a lightweight { id, lastEdited } list', async function () {
      const res = await request(server)
        .get(`/board/sync/${encodeURI(helper.boardData.email)}`)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('total').that.is.a('number');
      res.body.should.have.property('data').that.is.an('array');
      res.body.data.length.should.be.above(0);
      res.body.data.forEach((entry) => {
        entry.should.have.all.keys('id', 'lastEdited');
      });
      const ids = res.body.data.map((entry) => entry.id);
      expect(ids).to.include(this.boardId);
    });

    it('it should NOT return the sync list without authorization', async function () {
      await request(server)
        .get(`/board/sync/${encodeURI(helper.boardData.email)}`)
        .set('Accept', 'application/json')
        .expect(403);
    });

    it("only allows an admin to get another user's sync list", async function () {
      const adminEmail = helper.generateEmail();
      const admin = await helper.prepareUser(server, {
        role: 'admin',
        email: adminEmail,
      });

      const otherEmail = helper.generateEmail();
      const otherUser = await helper.prepareUser(server, {
        role: 'user',
        email: otherEmail,
      });

      // A non-admin requesting someone else's sync list is rejected.
      await request(server)
        .get(`/board/sync/${encodeURI(helper.boardData.email)}`)
        .set('Authorization', `Bearer ${otherUser.token}`)
        .expect({
          message: "You are not authorized to get this user's boards.",
        })
        .expect(403);

      // An admin can request any user's sync list.
      await request(server)
        .get(`/board/sync/${encodeURI(helper.boardData.email)}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
    });
  });

  describe('POST /board/byids', function () {
    let boardId1;
    let boardId2;

    // beforeEach (not before) so the boards belong to the user set up by the
    // parent beforeEach, which runs first and regenerates the test email.
    beforeEach(async function () {
      boardId1 = await helper.createMochaBoard(server, user.token);
      boardId2 = await helper.createMochaBoard(server, user.token);
    });

    it('it should return the requested boards', async function () {
      const res = await request(server)
        .post('/board/byids')
        .send({ ids: [boardId1, boardId2] })
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('total', 2);
      res.body.should.have.property('data').that.is.an('array');
      res.body.data.should.have.lengthOf(2);
      res.body.data.forEach((board) => helper.verifyBoardProperties(board));
      const returnedIds = res.body.data.map((b) => b.id);
      expect(returnedIds).to.have.members([boardId1, boardId2]);
    });

    it('it should ignore invalid ObjectIds and return only valid matches', async function () {
      const res = await request(server)
        .post('/board/byids')
        .send({ ids: [boardId1, 'not-a-valid-object-id'] })
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('total', 1);
      res.body.data.should.have.lengthOf(1);
      res.body.data[0].should.have.property('id', boardId1);
    });

    it('it should return 400 when ids contains only invalid ObjectIds', async function () {
      await request(server)
        .post('/board/byids')
        .send({ ids: ['not-a-valid-object-id'] })
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400);
    });

    it('it should return 400 for an empty ids array', async function () {
      await request(server)
        .post('/board/byids')
        .send({ ids: [] })
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect(400);
    });

    it('it should return 400 when ids exceeds the maximum allowed', async function () {
      const ids = Array.from({ length: 3001 }, () => boardId1);
      await request(server)
        .post('/board/byids')
        .send({ ids })
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect(400);
    });

    it('it should NOT return boards without authorization', async function () {
      await request(server)
        .post('/board/byids')
        .send({ ids: [boardId1] })
        .set('Accept', 'application/json')
        .expect(403);
    });

    it("it should not return another user's boards to a non-admin", async function () {
      const otherUser = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      const res = await request(server)
        .post('/board/byids')
        .send({ ids: [boardId1, boardId2] })
        .set('Authorization', `Bearer ${otherUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('total', 0);
      res.body.data.should.have.lengthOf(0);
    });
  });
});
