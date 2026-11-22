//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
const chai = require('chai');
var request = require('supertest');
var expect = require('chai').expect;
const should = chai.should();
const helper = require('../helper');

const jwt = require('jsonwebtoken');
const config = require('../../config');
const Board = require('../../api/models/Board');
const User = require('../../api/models/User');

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

    it('it should NOT POST a board owned by another user', async function () {
      const victim = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      const res = await request(server)
        .post('/board')
        .send({ ...helper.boardData, email: victim.email })
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('email', user.email);
      const stored = await Board.findById(res.body.id).lean();
      stored.email.should.equal(user.email);
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
    it('it should NOT GET all the boards without authorization', async function () {
      await request(server)
        .get('/board')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should NOT GET all the boards as a non-admin user', async function () {
      await request(server)
        .get('/board')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should GET all the boards as an admin', async function () {
      const admin = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.generateEmail(),
      });

      const res = await request(server)
        .get('/board')
        .set('Authorization', `Bearer ${admin.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyListProperties(res.body);
    });
  });

  describe('PUT /board/:boardid', function () {
    let owner;
    let otherUser;
    let admin;

    // The owner and the board are created in the same scope so the token used
    // in each test belongs to the board owner (the parent beforeEach creates a
    // new, unrelated user for every test).
    before(async function () {
      owner = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      otherUser = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      admin = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.generateEmail(),
      });
      this.boardId = await helper.createMochaBoard(server, owner.token, owner.email);
    });

    it('it should PUT a board', async function () {
      const boardData = { ...helper.boardData, email: owner.email };
      boardData.name = 'edited name';
      const res = await request(server)
        .put('/board/' + this.boardId)
        .send(boardData)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
    });

    it("it should NOT PUT another user's board", async function () {
      const before = await Board.findById(this.boardId).lean();

      await request(server)
        .put('/board/' + this.boardId)
        .send({ ...helper.boardData, name: 'edited by another user' })
        .set('Authorization', `Bearer ${otherUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      const after = await Board.findById(this.boardId).lean();
      after.name.should.equal(before.name);
      after.email.should.equal(owner.email);
    });

    it("it should PUT another user's board as an admin", async function () {
      const res = await request(server)
        .put('/board/' + this.boardId)
        .send({ ...helper.boardData, email: owner.email, name: 'edited by admin' })
        .set('Authorization', `Bearer ${admin.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
      res.body.should.have.property('name', 'edited by admin');
    });

    it('it should NOT change the board email for a non-admin owner', async function () {
      // `user` is an existing account created by the parent beforeEach, so the
      // email passes the model validation and only the ownership rule applies.
      const res = await request(server)
        .put('/board/' + this.boardId)
        .send({ ...helper.boardData, email: user.email, name: 'reassign attempt' })
        .set('Authorization', `Bearer ${owner.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('email', owner.email);
      const stored = await Board.findById(this.boardId).lean();
      stored.email.should.equal(owner.email);
    });

    it('it should PUT a board even when the body carries a stale __v (no VersionError)', async function () {
      // Simulates an older client that cached the board with the Mongoose
      // version key and echoes __v/_id/id back on update. The server must
      // ignore them instead of overwriting the real version and throwing a
      // VersionError on save.
      const boardData = {
        ...helper.boardData,
        email: owner.email,
        __v: 999,
        _id: this.boardId,
        name: 'edited with stale version',
        tiles: [{ label: 'changed' }],
      };

      const res = await request(server)
        .put('/board/' + this.boardId)
        .send(boardData)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
      res.body.should.have.property('name', 'edited with stale version');
      res.body.should.not.have.property('__v');
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
    let owner;
    let otherUser;
    let admin;

    before(async function () {
      owner = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      otherUser = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      admin = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.generateEmail(),
      });
      this.publicBoardId = await helper.createMochaBoard(server, owner.token, owner.email);

      const { body } = await request(server)
        .post('/board')
        .send({ ...helper.boardData, email: owner.email, isPublic: false })
        .set('Authorization', `Bearer ${owner.token}`)
        .set('Accept', 'application/json')
        .expect(200);
      this.privateBoardId = body.id;
    });

    it('it should GET a board', async function () {
      const res = await request(server)
        .get('/board/' + this.publicBoardId)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
    });

    it('it should GET a public board without authorization', async function () {
      const res = await request(server)
        .get('/board/' + this.publicBoardId)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
    });

    // 401, not 404: clients older than 1.40.0 delete their local copy of a
    // board when this endpoint returns 404 during sync.
    it('it should return 401 for a private board without authorization', async function () {
      await request(server)
        .get('/board/' + this.privateBoardId)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401);
    });

    it('it should return 401 for a private board with an invalid token', async function () {
      await request(server)
        .get('/board/' + this.privateBoardId)
        .set('Authorization', 'Bearer not-a-valid-token')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401);
    });

    it('it should return 401 for a private board with an expired token', async function () {
      const expiredToken = jwt.sign(
        {
          email: owner.email,
          id: owner.userId,
          issuer: config.jwt.issuer,
          exp: Math.floor(Date.now() / 1000) - 60
        },
        config.jwt.secret
      );
      await request(server)
        .get('/board/' + this.privateBoardId)
        .set('Authorization', `Bearer ${expiredToken}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401);
    });

    it('it should return 404 for a private board with a valid token of a deleted user', async function () {
      const deletedUser = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      await User.deleteOne({ _id: deletedUser.userId });
      await request(server)
        .get('/board/' + this.privateBoardId)
        .set('Authorization', `Bearer ${deletedUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);
    });

    it("it should NOT GET another user's private board", async function () {
      await request(server)
        .get('/board/' + this.privateBoardId)
        .set('Authorization', `Bearer ${otherUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);
    });

    it('it should GET a private board as its owner', async function () {
      const res = await request(server)
        .get('/board/' + this.privateBoardId)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
      res.body.should.have.property('isPublic', false);
    });

    it("it should GET another user's private board as an admin", async function () {
      const res = await request(server)
        .get('/board/' + this.privateBoardId)
        .set('Authorization', `Bearer ${admin.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
    });
  });

  describe('DELETE /board/:boardid', function () {
    let owner;

    // The owner and the board are created in the same scope so the token used
    // in each test belongs to the board owner.
    before(async function () {
      owner = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      this.boardId = await helper.createMochaBoard(server, owner.token, owner.email);
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
        .set('Authorization', `Bearer ${owner.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyBoardProperties(res.body);
    });

    it('it should NOT DELETE a board that was already removed ', async function () {
      await request(server)
        .del('/board/' + this.boardId)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);
    });

    it("returns a 404 if the caller is not an admin and doesn't own the board", async function () {
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

      const stillThere = await Board.findById(boardId);
      should.exist(stillThere);
    });

    it("deletes the board if the caller is an admin but doesn't own the board", async function () {
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

  describe('accessGateCode field behavior', function () {
    it('should normalize accessGateCode to uppercase when creating a board', async function () {
      const boardWithAccessCode = {
        ...helper.boardData,
        accessGateCode: 'cafe01'
      };
      const res = await request(server)
        .post('/board')
        .send(boardWithAccessCode)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('accessGateCode');
      res.body.accessGateCode.should.equal('CAFE01');
    });

    it('should trim whitespace from accessGateCode', async function () {
      const boardWithAccessCode = {
        ...helper.boardData,
        accessGateCode: '  test01  '
      };
      const res = await request(server)
        .post('/board')
        .send(boardWithAccessCode)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('accessGateCode');
      res.body.accessGateCode.should.equal('TEST01');
    });

    it('should default accessGateCode to null when not provided', async function () {
      const boardWithoutAccessCode = { ...helper.boardData };
      delete boardWithoutAccessCode.accessGateCode;

      const res = await request(server)
        .post('/board')
        .send(boardWithoutAccessCode)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('accessGateCode');
      should.equal(res.body.accessGateCode, null);
    });

    it('should update accessGateCode on an existing board', async function () {
      const boardId = await helper.createMochaBoard(server, user.token);

      const updateData = {
        ...helper.boardData,
        accessGateCode: 'updated01'
      };
      const res = await request(server)
        .put('/board/' + boardId)
        .send(updateData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('accessGateCode');
      res.body.accessGateCode.should.equal('UPDATED01');
    });

    it('should return accessGateCode in GET response when set', async function () {
      const boardWithAccessCode = {
        ...helper.boardData,
        accessGateCode: 'gettest01'
      };
      const createRes = await request(server)
        .post('/board')
        .send(boardWithAccessCode)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const boardId = createRes.body.id;

      const getRes = await request(server)
        .get('/board/' + boardId)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      getRes.body.should.have.property('accessGateCode');
      getRes.body.accessGateCode.should.equal('GETTEST01');
    });

    it('should exclude boards with accessGate from public boards listing', async function () {
      // Create a public board without accessGate
      const publicBoard = {
        ...helper.boardData,
        name: 'Public Board Without Code',
        isPublic: true
      };
      await request(server)
        .post('/board')
        .send(publicBoard)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect(200);

      // Create a public board with accessGateCode
      const publicBoardWithCode = {
        ...helper.boardData,
        name: 'Public Board With Code',
        isPublic: true,
        accessGateCode: 'public01'
      };
      await request(server)
        .post('/board')
        .send(publicBoardWithCode)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect(200);

      // Get public boards
      const res = await request(server)
        .get('/board/public')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      // Verify that boards with accessGateCode are not in the results
      const boardsWithCode = res.body.data.filter(b => b.name === 'Public Board With Code');
      boardsWithCode.length.should.equal(0);
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

    it('it should not expose the Mongoose _id/__v keys', async function () {
      // Leaking __v here is what caused clients to echo a stale version back on
      // update, triggering a VersionError. Boards must be normalized to `id`.
      const res = await request(server)
        .post('/board/byids')
        .send({ ids: [boardId1] })
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.data.should.have.lengthOf(1);
      res.body.data[0].should.have.property('id', boardId1);
      res.body.data[0].should.not.have.property('__v');
      res.body.data[0].should.not.have.property('_id');
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

  describe('GET /board/public search (regex escaping)', function () {
    it('it should treat regex special characters literally without erroring', async function () {
      // `(` is an invalid regex on its own and crashed the unescaped query.
      const res = await request(server)
        .get(`/board/public?search=${encodeURIComponent('(')}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyListProperties(res.body);
    });

    it('it should handle ReDoS-style patterns without erroring', async function () {
      const res = await request(server)
        .get(`/board/public?search=${encodeURIComponent('(a+)+$')}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyListProperties(res.body);
    });
  });
});
