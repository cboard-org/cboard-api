//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
const chai = require('chai');
var request = require('supertest');
var expect = require('chai').expect;
const should = chai.should();
const helper = require('../helper');

const AccessClient = require('../../api/models/AccessClient');
const AccessGate = require('../../api/models/AccessGate');
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
    const clients = await AccessClient.find({ 'client.name': /mocha test/i });
    const clientIds = clients.map(c => c._id);
    await AccessGate.deleteMany({ accessClient: { $in: clientIds } });
    await AccessClient.deleteMany({ 'client.name': /mocha test/i });
  });

  describe('POST /admin/access-clients', function () {
    it('it should CREATE an access client and auto-discover linked boards', async function () {
      const clientData = {
        slug: 'test-01',
        clientName: 'Test Client mocha test',
        clientContact: 'test@example.com',
        brandColor: '#FF5733',
        rootBoardId: testBoardId,
        accessGate: 'TEST01',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      const res = await request(server)
        .post('/admin/access-clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201);

      res.body.should.be.a('object');
      res.body.should.have.property('slug').eql('test-01');
      res.body.client.should.have.property('name').eql('Test Client mocha test');
      res.body.should.have.property('brandColor').eql('#FF5733');
      res.body.should.have.property('createdBy');
      res.body.should.have.property('accessPoint');
      res.body.accessPoint.should.have.property('code').eql('TEST01');
      // rootBoard has no tile links, so discovery returns just the root
      res.body.accessPoint.linkedBoardsIds.length.should.eql(1);

      // Verify board was marked with accessGate
      const board = await Board.findById(testBoardId);
      board.accessGateCode.should.eql('TEST01');
    });

    it('it should NOT CREATE with duplicate slug', async function () {
      const clientData = {
        slug: 'duplicate',
        clientName: 'Test Client mocha test',
        rootBoardId: testBoardId,
        accessGate: 'DUPL01',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      // Create first client
      await request(server)
        .post('/admin/access-clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      // Try to create with same slug
      const res = await request(server)
        .post('/admin/access-clients')
        .send({ ...clientData, accessGate: 'DUPL02' })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(409);

      res.body.should.have.property('message').eql('Slug already exists');
    });

    it('it should NOT CREATE with duplicate access point code', async function () {
      const clientData = {
        slug: 'duplicate-code-a',
        clientName: 'Test Client mocha test',
        rootBoardId: testBoardId,
        accessGate: 'DUPCODE',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      // Create first client
      await request(server)
        .post('/admin/access-clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      // Try to create with same accessGate but different slug
      const res = await request(server)
        .post('/admin/access-clients')
        .send({ ...clientData, slug: 'duplicate-code-b' })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(409);

      res.body.should.have.property('message').eql('Code already exists');
    });

    it('it should NOT CREATE with non-existent rootBoardId', async function () {
      const clientData = {
        slug: 'test-04',
        clientName: 'Test Client mocha test',
        rootBoardId: '507f1f77bcf86cd799439011', // Non-existent ID
        accessGate: 'TEST04',
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
        slug: 'test-05',
        clientName: 'Test Client mocha test',
        rootBoardId: testBoardId,
        accessGate: 'TEST05',
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
          slug: 'list-01',
          clientName: 'List Test 1 mocha test',
          rootBoardId: testBoardId,
          accessGate: 'LIST01',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        })
        .set('Authorization', `Bearer ${adminUser.token}`);

      await request(server)
        .post('/admin/access-clients')
        .send({
          slug: 'list-02',
          clientName: 'List Test 2 mocha test',
          rootBoardId: testBoardId,
          accessGate: 'LIST02',
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

      // Test boards have no tile links, so auto-discovery returns just root = 1 board
      const client1 = res.body.data.find((c) => c.slug === 'list-01');
      client1.should.have.property('boardCount').eql(1);
      client1.should.have.property('isExpired').eql(false);
      client1.should.have.property('daysUntilExpiry');
      client1.daysUntilExpiry.should.be.at.least(0);

      // Check expired client
      const client2 = res.body.data.find((c) => c.slug === 'list-02');
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

  describe('PUT /admin/access-clients/:slug', function () {
    beforeEach(async function () {
      await request(server)
        .post('/admin/access-clients')
        .send({
          slug: 'update-01',
          clientName: 'Update Test mocha test',
          rootBoardId: testBoardId,
          accessGate: 'UPDATE01',
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
        .put('/admin/access-clients/update-01')
        .send(updates)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.client.should.have.property('name').eql('Updated Name mocha test');
      res.body.should.have.property('brandColor').eql('#FFFFFF');
      res.body.should.have.property('isActive').eql(false);
    });

    it('it should UPDATE subscription dates', async function () {
      const newEndDate = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000); // 2 years
      const updates = {
        subscriptionEnd: newEndDate,
      };

      const res = await request(server)
        .put('/admin/access-clients/update-01')
        .send(updates)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const actualDate = new Date(res.body.subscriptionEnd);
      actualDate.getTime().should.be.closeTo(newEndDate.getTime(), 1000);
    });

    it('it should return 404 for non-existent slug', async function () {
      const res = await request(server)
        .put('/admin/access-clients/nonexistent')
        .send({ clientName: 'Test' })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Client not found');
    });

    it('it should NOT UPDATE without authorization', async function () {
      await request(server)
        .put('/admin/access-clients/update-01')
        .send({ clientName: 'Test' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('PUT /admin/access-points/:code', function () {
    beforeEach(async function () {
      await request(server)
        .post('/admin/access-clients')
        .send({
          slug: 'ap-update-01',
          clientName: 'Access Point Update Test mocha test',
          rootBoardId: testBoardId,
          accessGate: 'APUPDATE01',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should re-discover boards when updating access point root', async function () {
      const res = await request(server)
        .put('/admin/access-points/APUPDATE01')
        .send({ rootBoardId: testBoardId2 })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('code').eql('APUPDATE01');
      res.body.should.have.property('linkedBoardsIds').that.is.an('array');
      res.body.linkedBoardsIds.should.include(testBoardId2.toString());

      // Verify new root board was marked with accessGate
      const board = await Board.findById(testBoardId2);
      board.accessGateCode.should.eql('APUPDATE01');
    });

    it('it should re-discover without changing root when no rootBoardId provided', async function () {
      const res = await request(server)
        .put('/admin/access-points/APUPDATE01')
        .send({})
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('code').eql('APUPDATE01');
      res.body.linkedBoardsIds.should.include(testBoardId.toString());
    });

    it('it should return 404 for non-existent access point code', async function () {
      const res = await request(server)
        .put('/admin/access-points/NONEXISTENT')
        .send({})
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Access point not found');
    });

    it('it should NOT UPDATE without authorization', async function () {
      await request(server)
        .put('/admin/access-points/APUPDATE01')
        .send({})
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('GET /admin/access-clients/:slug/stats', function () {
    beforeEach(async function () {
      await request(server)
        .post('/admin/access-clients')
        .send({
          slug: 'stats-01',
          clientName: 'Stats Test mocha test',
          rootBoardId: testBoardId,
          accessGate: 'STATS01',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should GET client statistics', async function () {
      const res = await request(server)
        .get('/admin/access-clients/stats-01/stats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.be.a('object');
      res.body.should.have.property('client');
      res.body.should.have.property('stats');

      // Verify client data
      res.body.client.should.have.property('slug').eql('stats-01');
      res.body.client.client.should.have.property('name').eql('Stats Test mocha test');

      // Verify stats — test board has no tile links, so auto-discovery returns 1 board
      res.body.stats.should.have.property('totalAccesses').eql(0);
      res.body.stats.should.have.property('boardCount').eql(1);
      res.body.stats.should.have.property('boards').that.is.an('array');
      res.body.stats.boards.length.should.eql(1);
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
          slug: 'expired-01',
          clientName: 'Expired Test mocha test',
          rootBoardId: testBoardId,
          accessGate: 'EXPIRED01',
          subscriptionStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          subscriptionEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        })
        .set('Authorization', `Bearer ${adminUser.token}`);

      const res = await request(server)
        .get('/admin/access-clients/expired-01/stats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.stats.should.have.property('isExpired').eql(true);
      res.body.stats.should.have.property('daysUntilExpiry').eql(0); // Clamped at 0
    });

    it('it should return 404 for non-existent slug', async function () {
      const res = await request(server)
        .get('/admin/access-clients/nonexistent/stats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Client not found');
    });

    it('it should NOT GET stats without authorization', async function () {
      await request(server)
        .get('/admin/access-clients/stats-01/stats')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });
});
