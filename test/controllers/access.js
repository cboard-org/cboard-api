//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
const chai = require('chai');
var request = require('supertest');
var expect = require('chai').expect;
const should = chai.should();
const helper = require('../helper');

const AccessClient = require('../../api/models/AccessClient');
const Board = require('../../api/models/Board');

//Parent block
describe('Access API calls', function () {
  let adminUser;
  let regularUser;
  let server;
  let testBoardId;
  let testBoardId2;

  before(async function () {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
  });

  beforeEach(async function () {
    // Create admin user
    adminUser = await helper.prepareUser(server, {
      role: 'admin',
      email: helper.generateEmail(),
    });

    // Create regular user
    regularUser = await helper.prepareUser(server, {
      role: 'user',
      email: helper.generateEmail(),
    });

    // Create test boards
    testBoardId = await helper.createMochaBoard(server, adminUser.token);
    testBoardId2 = await helper.createMochaBoard(server, adminUser.token);
  });

  after(async function () {
    helper.prepareNodemailerMock(true); //disable mockery
    await helper.deleteMochaUsers();
    await Board.deleteMany({ author: 'cboard mocha test' });
    await AccessClient.deleteMany({ clientName: /mocha test/i });
  });

  describe('POST /admin/access-clients', function () {
    it('it should CREATE an access client with rootBoard only', async function () {
      const clientData = {
        code: 'TEST01',
        clientName: 'Test Client mocha test',
        clientContact: 'test@example.com',
        brandColor: '#FF5733',
        rootBoardId: testBoardId,
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      };

      const res = await request(server)
        .post('/admin/access-clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201);

      res.body.should.be.a('object');
      res.body.should.have.property('code').eql('TEST01');
      res.body.should.have.property('clientName').eql('Test Client mocha test');
      res.body.should.have.property('brandColor').eql('#FF5733');
      res.body.should.have.property('createdBy');

      // Verify board was updated with accessCode
      const board = await Board.findById(testBoardId);
      board.accessCode.should.eql('TEST01');
    });

    it('it should CREATE an access client with multiple boards', async function () {
      const clientData = {
        code: 'TEST02',
        clientName: 'Test Client 2 mocha test',
        rootBoardId: testBoardId,
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        boardIds: [testBoardId, testBoardId2],
      };

      const res = await request(server)
        .post('/admin/access-clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201);

      res.body.should.have.property('code').eql('TEST02');

      // Verify both boards were updated
      const board1 = await Board.findById(testBoardId);
      const board2 = await Board.findById(testBoardId2);
      board1.accessCode.should.eql('TEST02');
      board2.accessCode.should.eql('TEST02');
    });

    it('it should include rootBoard even when boardIds is empty array', async function () {
      const clientData = {
        code: 'TEST03',
        clientName: 'Test Client 3 mocha test',
        rootBoardId: testBoardId,
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        boardIds: [], // Empty array
      };

      const res = await request(server)
        .post('/admin/access-clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201);

      // Verify rootBoard was updated despite empty boardIds
      const board = await Board.findById(testBoardId);
      board.accessCode.should.eql('TEST03');
    });

    it('it should NOT CREATE with duplicate code', async function () {
      const clientData = {
        code: 'DUPLICATE',
        clientName: 'Test Client mocha test',
        rootBoardId: testBoardId,
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      // Create first client
      await request(server)
        .post('/admin/access-clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      // Try to create duplicate
      const res = await request(server)
        .post('/admin/access-clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(409);

      res.body.should.have.property('message').eql('Code already exists');
    });

    it('it should NOT CREATE with non-existent rootBoardId', async function () {
      const clientData = {
        code: 'TEST04',
        clientName: 'Test Client mocha test',
        rootBoardId: '507f1f77bcf86cd799439011', // Non-existent ID
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      const res = await request(server)
        .post('/admin/access-clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Root board not found');
    });

    it('it should NOT CREATE without authorization', async function () {
      const clientData = {
        code: 'TEST05',
        clientName: 'Test Client mocha test',
        rootBoardId: testBoardId,
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      await request(server)
        .post('/admin/access-clients')
        .send(clientData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('GET /admin/access-clients', function () {
    beforeEach(async function () {
      // Create test clients
      await request(server)
        .post('/admin/access-clients')
        .send({
          code: 'LIST01',
          clientName: 'List Test 1 mocha test',
          rootBoardId: testBoardId,
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          boardIds: [testBoardId, testBoardId2],
        })
        .set('Authorization', `Bearer ${adminUser.token}`);

      await request(server)
        .post('/admin/access-clients')
        .send({
          code: 'LIST02',
          clientName: 'List Test 2 mocha test',
          rootBoardId: testBoardId,
          subscriptionStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          subscriptionEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Expired
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should LIST all access clients with stats', async function () {
      const res = await request(server)
        .get('/admin/access-clients')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.be.a('object');
      res.body.should.have.property('total');
      res.body.should.have.property('data').that.is.an('array');
      res.body.data.length.should.be.at.least(2);

      // Check first client
      const client1 = res.body.data.find((c) => c.code === 'LIST01');
      client1.should.have.property('boardCount').eql(2);
      client1.should.have.property('isExpired').eql(false);
      client1.should.have.property('daysUntilExpiry');
      client1.daysUntilExpiry.should.be.at.least(0);

      // Check expired client
      const client2 = res.body.data.find((c) => c.code === 'LIST02');
      client2.should.have.property('isExpired').eql(true);
      client2.should.have.property('daysUntilExpiry').eql(0); // Should be clamped at 0
    });

    it('it should NOT LIST without authorization', async function () {
      await request(server)
        .get('/admin/access-clients')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('PUT /admin/access-clients/:code', function () {
    beforeEach(async function () {
      await request(server)
        .post('/admin/access-clients')
        .send({
          code: 'UPDATE01',
          clientName: 'Update Test mocha test',
          rootBoardId: testBoardId,
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          brandColor: '#000000',
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should UPDATE an access client', async function () {
      const updates = {
        clientName: 'Updated Name mocha test',
        brandColor: '#FFFFFF',
        isActive: false,
      };

      const res = await request(server)
        .put('/admin/access-clients/UPDATE01')
        .send(updates)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('clientName').eql('Updated Name mocha test');
      res.body.should.have.property('brandColor').eql('#FFFFFF');
      res.body.should.have.property('isActive').eql(false);
    });

    it('it should UPDATE subscription dates', async function () {
      const newEndDate = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000); // 2 years
      const updates = {
        subscriptionEnd: newEndDate,
      };

      const res = await request(server)
        .put('/admin/access-clients/UPDATE01')
        .send(updates)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const actualDate = new Date(res.body.subscriptionEnd);
      actualDate.getTime().should.be.closeTo(newEndDate.getTime(), 1000);
    });

    it('it should return 404 for non-existent code', async function () {
      const res = await request(server)
        .put('/admin/access-clients/NONEXISTENT')
        .send({ clientName: 'Test' })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Client not found');
    });

    it('it should NOT UPDATE without authorization', async function () {
      await request(server)
        .put('/admin/access-clients/UPDATE01')
        .send({ clientName: 'Test' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('GET /admin/access-clients/:code/stats', function () {
    beforeEach(async function () {
      await request(server)
        .post('/admin/access-clients')
        .send({
          code: 'STATS01',
          clientName: 'Stats Test mocha test',
          rootBoardId: testBoardId,
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          boardIds: [testBoardId, testBoardId2],
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should GET client statistics', async function () {
      const res = await request(server)
        .get('/admin/access-clients/STATS01/stats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.be.a('object');
      res.body.should.have.property('client');
      res.body.should.have.property('stats');

      // Verify client data
      res.body.client.should.have.property('code').eql('STATS01');
      res.body.client.should.have.property('clientName').eql('Stats Test mocha test');

      // Verify stats
      res.body.stats.should.have.property('totalAccesses').eql(0);
      res.body.stats.should.have.property('boardCount').eql(2);
      res.body.stats.should.have.property('boards').that.is.an('array');
      res.body.stats.boards.length.should.eql(2);
      res.body.stats.should.have.property('daysUntilExpiry');
      res.body.stats.daysUntilExpiry.should.be.at.least(0);
      res.body.stats.should.have.property('isExpired').eql(false);

      // Verify board details
      res.body.stats.boards[0].should.have.property('id');
      res.body.stats.boards[0].should.have.property('name');
      res.body.stats.boards[0].should.have.property('tilesCount');
    });

    it('it should return 0 daysUntilExpiry for expired client', async function () {
      // Create expired client
      await request(server)
        .post('/admin/access-clients')
        .send({
          code: 'EXPIRED01',
          clientName: 'Expired Test mocha test',
          rootBoardId: testBoardId,
          subscriptionStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          subscriptionEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        })
        .set('Authorization', `Bearer ${adminUser.token}`);

      const res = await request(server)
        .get('/admin/access-clients/EXPIRED01/stats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.stats.should.have.property('isExpired').eql(true);
      res.body.stats.should.have.property('daysUntilExpiry').eql(0); // Clamped at 0
    });

    it('it should return 404 for non-existent code', async function () {
      const res = await request(server)
        .get('/admin/access-clients/NONEXISTENT/stats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Client not found');
    });

    it('it should NOT GET stats without authorization', async function () {
      await request(server)
        .get('/admin/access-clients/STATS01/stats')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });
});
