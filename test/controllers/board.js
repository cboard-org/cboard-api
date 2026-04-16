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

  describe('accessGate field behavior', function () {
    it('should normalize accessGate to uppercase when creating a board', async function () {
      const boardWithAccessCode = {
        ...helper.boardData,
        accessGate: 'cafe01'
      };
      const res = await request(server)
        .post('/board')
        .send(boardWithAccessCode)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('accessGate');
      res.body.accessGate.should.equal('CAFE01');
    });

    it('should trim whitespace from accessGate', async function () {
      const boardWithAccessCode = {
        ...helper.boardData,
        accessGate: '  test01  '
      };
      const res = await request(server)
        .post('/board')
        .send(boardWithAccessCode)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('accessGate');
      res.body.accessGate.should.equal('TEST01');
    });

    it('should default accessGate to null when not provided', async function () {
      const boardWithoutAccessCode = { ...helper.boardData };
      delete boardWithoutAccessCode.accessGate;

      const res = await request(server)
        .post('/board')
        .send(boardWithoutAccessCode)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.accessGate.should.equal(null);
    });

    it('should update accessGate on an existing board', async function () {
      const boardId = await helper.createMochaBoard(server, user.token);

      const updateData = {
        ...helper.boardData,
        accessGate: 'updated01'
      };
      const res = await request(server)
        .put('/board/' + boardId)
        .send(updateData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('accessGate');
      res.body.accessGate.should.equal('UPDATED01');
    });

    it('should return accessGate in GET response when set', async function () {
      const boardWithAccessCode = {
        ...helper.boardData,
        accessGate: 'gettest01'
      };
      const createRes = await request(server)
        .post('/board')
        .send(boardWithAccessCode)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const boardId = createRes.body.id;

      // Direct access should be blocked with 403 for regular users
      const getRes = await request(server)
        .get('/board/' + boardId)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);

      getRes.body.should.have.property('message');
      getRes.body.message.should.equal('This board requires an access code');
      getRes.body.should.have.property('requiresAccessCode');
      getRes.body.requiresAccessCode.should.equal(true);
      getRes.body.should.have.property('accessGate');
      getRes.body.accessGate.should.equal('GETTEST01');

      // Admins should be able to access the board directly
      const adminEmail = helper.generateEmail();
      const admin = await helper.prepareUser(server, { role: 'admin', email: adminEmail });
      const adminRes = await request(server)
        .get('/board/' + boardId)
        .set('Authorization', `Bearer ${admin.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      adminRes.body.should.have.property('accessGate');
      adminRes.body.accessGate.should.equal('GETTEST01');
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

      // Create a public board with accessGate
      const publicBoardWithCode = {
        ...helper.boardData,
        name: 'Public Board With Code',
        isPublic: true,
        accessGate: 'public01'
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

      // Verify that boards with accessGate are not in the results
      const boardsWithAccessCode = res.body.data.filter(b => b.accessGate !== null && b.accessGate !== undefined);
      boardsWithAccessCode.should.have.lengthOf(0);
      getRes.body.should.have.property('accessGate');
      getRes.body.accessGate.should.equal('GETTEST01');
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
