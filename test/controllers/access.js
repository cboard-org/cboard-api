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
const User = require('../../api/models/User');

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
    this.timeout(10000);
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
    testBoardId = await helper.createMochaBoard(server, adminUser.token, adminUser.email);
    testBoardId2 = await helper.createMochaBoard(server, adminUser.token, adminUser.email);
  
    const clients = await AccessClient.find({ name: /mocha test/i });
    const clientIds = clients.map(c => c._id);
    await AccessGate.deleteMany({ accessClientId: { $in: clientIds } });
    await AccessClient.deleteMany({ name: /mocha test/i });
  });

  after(async function () {
    helper.prepareNodemailerMock(true); //disable mockery
    await helper.deleteMochaUsers();
    await Board.deleteMany({ author: 'cboard mocha test' });
    const clients = await AccessClient.find({ name: /mocha test/i });
    const clientIds = clients.map(c => c._id);
    await AccessGate.deleteMany({ accessClientId: { $in: clientIds } });
    await AccessClient.deleteMany({ name: /mocha test/i });
  });

  describe('POST /admin/access/clients', function () {
    it('it should CREATE an access client and auto-discover linked boards', async function () {
      const clientData = {
        slug: 'test-01',
        clientName: 'Test Client mocha test',
        contactName: 'Jane Doe',
        clientEmail: 'test@example.com',
        brandColor: '#FF5733',
        rootBoardId: testBoardId,
        accessGateCode: 'TEST01',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      const res = await request(server)
        .post('/admin/access/clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201);

      res.body.should.be.a('object');
      res.body.should.have.property('slug').eql('test-01');
      res.body.should.have.property('name').eql('Test Client mocha test');
      res.body.contact.should.have.property('name').eql('Jane Doe');
      res.body.contact.should.have.property('email').eql('test@example.com');
      res.body.should.have.property('members').eql([]);
      res.body.should.have.property('brandColor').eql('#FF5733');
      res.body.should.have.property('createdBy');
      res.body.should.have.property('accessGate');
      res.body.accessGate.should.have.property('code').eql('TEST01');
      // rootBoard has no tile links, so discovery returns just the root
      res.body.accessGate.linkedBoardIds.length.should.eql(1);

      // Verify board was marked with accessGate
      const board = await Board.findById(testBoardId);
      board.accessGateCode.should.eql('TEST01');
    });

    it('it should NOT CREATE with duplicate slug', async function () {
      const clientData = {
        slug: 'duplicate',
        clientName: 'Test Client mocha test',
        rootBoardId: testBoardId,
        accessGateCode: 'DUPL01',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      // Create first client
      await request(server)
        .post('/admin/access/clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      // Try to create with same slug
      const res = await request(server)
        .post('/admin/access/clients')
        .send({ ...clientData, accessGateCode: 'DUPL02' })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(409);

      res.body.should.have.property('message').eql('Slug already exists');
    });

    it('it should NOT CREATE with duplicate access gate code', async function () {
      const clientData = {
        slug: 'duplicate-code-a',
        clientName: 'Test Client mocha test',
        rootBoardId: testBoardId,
        accessGateCode: 'DUPCODE',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      // Create first client
      await request(server)
        .post('/admin/access/clients')
        .send(clientData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      // Try to create with same accessGate but different slug
      const res = await request(server)
        .post('/admin/access/clients')
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
        accessGateCode: 'TEST04',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      const res = await request(server)
        .post('/admin/access/clients')
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
        accessGateCode: 'TEST05',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      await request(server)
        .post('/admin/access/clients')
        .send(clientData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('GET /admin/access/clients', function () {
    beforeEach(async function () {
      // Create test clients
      await request(server)
        .post('/admin/access/clients')
        .send({
          slug: 'list-01',
          clientName: 'List Test 1 mocha test',
          rootBoardId: testBoardId,
          accessGateCode: 'LIST01',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        })
        .set('Authorization', `Bearer ${adminUser.token}`);

      await request(server)
        .post('/admin/access/clients')
        .send({
          slug: 'list-02',
          clientName: 'List Test 2 mocha test',
          rootBoardId: testBoardId,
          accessGateCode: 'LIST02',
          subscriptionStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          subscriptionEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Expired
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should LIST all access clients with stats', async function () {
      const res = await request(server)
        .get('/admin/access/clients')
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
        .get('/admin/access/clients')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('PUT /admin/access/clients/:slug', function () {
    beforeEach(async function () {
      await request(server)
        .post('/admin/access/clients')
        .send({
          slug: 'update-01',
          clientName: 'Update Test mocha test',
          rootBoardId: testBoardId,
          accessGateCode: 'UPDATE01',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          brandColor: '#000000',
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should UPDATE an access client', async function () {
      const updates = {
        clientName: 'Updated Name mocha test',
        contactName: 'John Doe',
        brandColor: '#FFFFFF',
        isActive: false,
      };

      const res = await request(server)
        .put('/admin/access/clients/update-01')
        .send(updates)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('name').eql('Updated Name mocha test');
      res.body.contact.should.have.property('name').eql('John Doe');
      res.body.should.have.property('brandColor').eql('#FFFFFF');
      res.body.should.have.property('isActive').eql(false);
    });

    it('it should UPDATE subscription dates', async function () {
      const newEndDate = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000); // 2 years
      const updates = {
        subscriptionEnd: newEndDate,
      };

      const res = await request(server)
        .put('/admin/access/clients/update-01')
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
        .put('/admin/access/clients/nonexistent')
        .send({ clientName: 'Test' })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Client not found');
    });

    it('it should NOT UPDATE without authorization', async function () {
      await request(server)
        .put('/admin/access/clients/update-01')
        .send({ clientName: 'Test' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('PUT /admin/access/gates/:code', function () {
    beforeEach(async function () {
      await request(server)
        .post('/admin/access/clients')
        .send({
          slug: 'ap-update-01',
          clientName: 'Access Gate Update Test mocha test',
          rootBoardId: testBoardId,
          accessGateCode: 'APUPDATE01',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should re-discover boards when updating access gate root', async function () {
      const res = await request(server)
        .put('/admin/access/gates/APUPDATE01')
        .send({ rootBoardId: testBoardId2 })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('code').eql('APUPDATE01');
      res.body.should.have.property('linkedBoardIds').that.is.an('array');
      res.body.linkedBoardIds.should.include(testBoardId2.toString());

      // Verify new root board was marked with accessGate
      const board = await Board.findById(testBoardId2);
      board.accessGateCode.should.eql('APUPDATE01');
    });

    it('it should clear accessGateCode from boards no longer linked after root change', async function () {
      // testBoardId was the original root, so it has accessGateCode set
      const before = await Board.findById(testBoardId);
      before.accessGateCode.should.eql('APUPDATE01');

      // Switch root to testBoardId2 — testBoardId should lose its accessGateCode
      await request(server)
        .put('/admin/access/gates/APUPDATE01')
        .send({ rootBoardId: testBoardId2 })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      const delinked = await Board.findById(testBoardId);
      expect(delinked.accessGateCode).to.be.null;

      const linked = await Board.findById(testBoardId2);
      linked.accessGateCode.should.eql('APUPDATE01');
    });

    it('it should re-discover without changing root when no rootBoardId provided', async function () {
      const res = await request(server)
        .put('/admin/access/gates/APUPDATE01')
        .send({})
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('code').eql('APUPDATE01');
      res.body.linkedBoardIds.should.include(testBoardId.toString());
    });

    it('it should return 404 for non-existent access gate code', async function () {
      const res = await request(server)
        .put('/admin/access/gates/NONEXISTENT')
        .send({})
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Access gate not found');
    });

    it('it should NOT UPDATE without authorization', async function () {
      await request(server)
        .put('/admin/access/gates/APUPDATE01')
        .send({})
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('GET /admin/access/clients/:slug/stats', function () {
    beforeEach(async function () {
      await request(server)
        .post('/admin/access/clients')
        .send({
          slug: 'stats-01',
          clientName: 'Stats Test mocha test',
          rootBoardId: testBoardId,
          accessGateCode: 'STATS01',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should GET client statistics', async function () {
      const res = await request(server)
        .get('/admin/access/clients/stats-01/stats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.be.a('object');
      res.body.should.have.property('client');
      res.body.should.have.property('stats');

      // Verify client data
      res.body.client.should.have.property('slug').eql('stats-01');
      res.body.client.should.have.property('name').eql('Stats Test mocha test');

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
        .post('/admin/access/clients')
        .send({
          slug: 'expired-01',
          clientName: 'Expired Test mocha test',
          rootBoardId: testBoardId,
          accessGateCode: 'EXPIRED01',
          subscriptionStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          subscriptionEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        })
        .set('Authorization', `Bearer ${adminUser.token}`);

      const res = await request(server)
        .get('/admin/access/clients/expired-01/stats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.stats.should.have.property('isExpired').eql(true);
      res.body.stats.should.have.property('daysUntilExpiry').eql(0); // Clamped at 0
    });

    it('it should return 404 for non-existent slug', async function () {
      const res = await request(server)
        .get('/admin/access/clients/nonexistent/stats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Client not found');
    });

    it('it should NOT GET stats without authorization', async function () {
      await request(server)
        .get('/admin/access/clients/stats-01/stats')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('GET /access/:clientSlug/:gateCode', function () {
    // The controller updates viewsCount/lastAccessAt fire-and-forget, so tests
    // that assert on those fields need a tiny delay for the async write to land.
    const waitForAnalytics = () => new Promise(resolve => setTimeout(resolve, 100));

    beforeEach(async function () {
      await request(server)
        .post('/admin/access/clients')
        .send({
          slug: 'public-01',
          clientName: 'Public Access mocha test',
          rootBoardId: testBoardId,
          accessGateCode: 'PUBLIC01',
          brandColor: '#123456',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should GET boards for a valid slug + code pair', async function () {
      const res = await request(server)
        .get('/access/public-01/PUBLIC01')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('client');
      res.body.client.should.have.property('slug').eql('public-01');
      res.body.client.should.have.property('name').eql('Public Access mocha test');
      res.body.client.should.have.property('color').eql('#123456');
      res.body.should.have.property('boards').that.is.an('array');
      res.body.boards.length.should.be.at.least(1);
      res.body.should.have.property('rootBoardId').eql(testBoardId.toString());
    });

    it('it should accept a lowercase gate code (case-insensitive)', async function () {
      await request(server)
        .get('/access/public-01/public01')
        .set('Accept', 'application/json')
        .expect(200);
    });

    it('it should increment viewsCount and update lastAccessAt', async function () {
      const before = await AccessGate.findOne({ code: 'PUBLIC01' });
      const startCount = before.viewsCount || 0;

      await request(server)
        .get('/access/public-01/PUBLIC01')
        .set('Accept', 'application/json')
        .expect(200);

      await waitForAnalytics();

      const after = await AccessGate.findOne({ code: 'PUBLIC01' });
      after.viewsCount.should.eql(startCount + 1);
      should.exist(after.lastAccessAt);
      if (before.lastAccessAt) {
        after.lastAccessAt.getTime().should.be.at.least(before.lastAccessAt.getTime());
      }
    });

    it('it should return 404 for a non-existent gate code', async function () {
      const res = await request(server)
        .get('/access/public-01/NOPE')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Invalid access code');
    });

    it('it should return 404 when slug does not match the gate\'s client', async function () {
      // Create a second client so its slug exists but does not own PUBLIC01
      await request(server)
        .post('/admin/access/clients')
        .send({
          slug: 'other-01',
          clientName: 'Other Client mocha test',
          rootBoardId: testBoardId2,
          accessGateCode: 'OTHER01',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        })
        .set('Authorization', `Bearer ${adminUser.token}`);

      const res = await request(server)
        .get('/access/other-01/PUBLIC01')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Invalid or expired access code');
    });

    it('it should return 404 when the client subscription has expired', async function () {
      await AccessClient.updateOne(
        { slug: 'public-01' },
        { $set: { subscriptionEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      );

      const res = await request(server)
        .get('/access/public-01/PUBLIC01')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Invalid or expired access code');
    });

    it('it should return 404 when the client is inactive', async function () {
      await AccessClient.updateOne(
        { slug: 'public-01' },
        { $set: { isActive: false } }
      );

      const res = await request(server)
        .get('/access/public-01/PUBLIC01')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Invalid or expired access code');
    });
  });

  describe('Access client members', function () {
    let secondUser;

    beforeEach(async function () {
      secondUser = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
    });

    const memberClientData = members => ({
      slug: 'members-01',
      clientName: 'Members Client mocha test',
      rootBoardId: testBoardId,
      accessGateCode: 'MEMBERS01',
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      members,
    });

    const memberIds = res => res.body.members.map(member => member.userId);

    it('it should set the members and flag them as access clients on create', async function () {
      const res = await request(server)
        .post('/admin/access/clients')
        .send(memberClientData([{ email: regularUser.email }, { email: secondUser.email }]))
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201);

      memberIds(res).should.have.members([
        regularUser.userId.toString(),
        secondUser.userId.toString(),
      ]);

      const firstMember = await User.findById(regularUser.userId);
      firstMember.isAccessClient.should.eql(true);
      const secondMember = await User.findById(secondUser.userId);
      secondMember.isAccessClient.should.eql(true);
    });

    it('it should ignore duplicated member emails', async function () {
      const res = await request(server)
        .post('/admin/access/clients')
        .send(memberClientData([{ email: regularUser.email }, { email: regularUser.email }]))
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      memberIds(res).should.eql([regularUser.userId.toString()]);
    });

    it('it should NOT CREATE with a non-existent member email', async function () {
      const unknownEmail = helper.generateEmail();

      const res = await request(server)
        .post('/admin/access/clients')
        .send(memberClientData([{ email: regularUser.email }, { email: unknownEmail }]))
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Member user not found');
      res.body.should.have.property('emails').eql([unknownEmail]);

      const client = await AccessClient.findOne({ slug: 'members-01' });
      expect(client).to.be.null;
      const user = await User.findById(regularUser.userId);
      user.isAccessClient.should.eql(false);
    });

    it('it should create a client without members when members is not provided', async function () {
      const { members, ...data } = memberClientData();

      const res = await request(server)
        .post('/admin/access/clients')
        .send(data)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      res.body.should.have.property('members').eql([]);
    });

    it('it should replace the members on update and sync the flags', async function () {
      await request(server)
        .post('/admin/access/clients')
        .send(memberClientData([{ email: regularUser.email }]))
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      const res = await request(server)
        .put('/admin/access/clients/members-01')
        .send({ members: [{ email: secondUser.email }] })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      memberIds(res).should.eql([secondUser.userId.toString()]);

      const removedMember = await User.findById(regularUser.userId);
      removedMember.isAccessClient.should.eql(false);
      const addedMember = await User.findById(secondUser.userId);
      addedMember.isAccessClient.should.eql(true);
    });

    it('it should keep the flag of a member that still belongs to another client', async function () {
      await request(server)
        .post('/admin/access/clients')
        .send(memberClientData([{ email: regularUser.email }]))
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      await request(server)
        .post('/admin/access/clients')
        .send({
          ...memberClientData([{ email: regularUser.email }]),
          slug: 'members-02',
          accessGateCode: 'MEMBERS02',
          rootBoardId: testBoardId2,
        })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      await request(server)
        .put('/admin/access/clients/members-01')
        .send({ members: [] })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      const user = await User.findById(regularUser.userId);
      user.isAccessClient.should.eql(true);
    });

    it('it should remove all members on update with an empty list', async function () {
      await request(server)
        .post('/admin/access/clients')
        .send(memberClientData([{ email: regularUser.email }]))
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      const res = await request(server)
        .put('/admin/access/clients/members-01')
        .send({ members: [] })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      res.body.should.have.property('members').eql([]);

      const removedMember = await User.findById(regularUser.userId);
      removedMember.isAccessClient.should.eql(false);
    });

    it('it should keep the members when members is not sent on update', async function () {
      await request(server)
        .post('/admin/access/clients')
        .send(memberClientData([{ email: regularUser.email }]))
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      const res = await request(server)
        .put('/admin/access/clients/members-01')
        .send({ brandColor: '#FFFFFF' })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      memberIds(res).should.eql([regularUser.userId.toString()]);
    });

    it('it should NOT UPDATE with a non-existent member email', async function () {
      await request(server)
        .post('/admin/access/clients')
        .send(memberClientData([{ email: regularUser.email }]))
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(201);

      const unknownEmail = helper.generateEmail();

      const res = await request(server)
        .put('/admin/access/clients/members-01')
        .send({ members: [{ email: unknownEmail }] })
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Member user not found');
      res.body.should.have.property('emails').eql([unknownEmail]);

      const client = await AccessClient.findOne({ slug: 'members-01' });
      client.members.map(member => member.userId.toString()).should.eql([
        regularUser.userId.toString(),
      ]);
    });
  });

  describe('GET /access/me/clients', function () {
    beforeEach(async function () {
      await request(server)
        .post('/admin/access/clients')
        .send({
          slug: 'mine-01',
          clientName: 'Mine Client mocha test',
          rootBoardId: testBoardId,
          accessGateCode: 'MINE01',
          brandColor: '#654321',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          members: [{ email: regularUser.email }],
        })
        .set('Authorization', `Bearer ${adminUser.token}`);

      await request(server)
        .post('/admin/access/clients')
        .send({
          slug: 'not-mine-01',
          clientName: 'Not Mine Client mocha test',
          rootBoardId: testBoardId2,
          accessGateCode: 'NOTMINE01',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should LIST only the clients the user is a member of', async function () {
      const res = await request(server)
        .get('/access/me/clients')
        .set('Authorization', `Bearer ${regularUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.have.property('total').eql(1);
      res.body.data.length.should.eql(1);

      const client = res.body.data[0];
      client.should.have.property('slug').eql('mine-01');
      client.should.have.property('clientName').eql('Mine Client mocha test');
      client.should.have.property('brandColor').eql('#654321');
      client.should.have.property('isActive').eql(true);
      client.should.have.property('isExpired').eql(false);
      client.should.have.property('daysUntilExpiry');
      client.should.have.property('subscriptionEnd');
      client.accessGates.length.should.eql(1);
      client.accessGates[0].should.have.property('code').eql('MINE01');
      client.accessGates[0].should.have.property('viewsCount').eql(0);
      client.accessGates[0].should.have.property('lastAccessAt');
      client.accessGates[0].rootBoard.should.have.property('id').eql(testBoardId.toString());
    });

    it('it should reflect gate views in the counters', async function () {
      await request(server).get('/access/mine-01/MINE01').expect(200);
      await new Promise(resolve => setTimeout(resolve, 100));

      const res = await request(server)
        .get('/access/me/clients')
        .set('Authorization', `Bearer ${regularUser.token}`)
        .expect(200);

      const gate = res.body.data[0].accessGates[0];
      gate.viewsCount.should.eql(1);
      should.exist(gate.lastAccessAt);
    });

    it('it should return an empty list for a user without clients', async function () {
      const res = await request(server)
        .get('/access/me/clients')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect(200);

      res.body.should.have.property('total').eql(0);
      res.body.data.should.eql([]);
    });

    it('it should NOT LIST without authorization', async function () {
      await request(server)
        .get('/access/me/clients')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('GET /access/me/clients/:slug/stats', function () {
    beforeEach(async function () {
      await request(server)
        .post('/admin/access/clients')
        .send({
          slug: 'mystats-01',
          clientName: 'My Stats mocha test',
          rootBoardId: testBoardId,
          accessGateCode: 'MYSTATS01',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          members: [{ email: regularUser.email }],
        })
        .set('Authorization', `Bearer ${adminUser.token}`);
    });

    it('it should GET statistics for a client the user is a member of', async function () {
      const res = await request(server)
        .get('/access/me/clients/mystats-01/stats')
        .set('Authorization', `Bearer ${regularUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.client.should.have.property('slug').eql('mystats-01');
      res.body.client.should.have.property('name').eql('My Stats mocha test');
      res.body.client.should.not.have.property('createdBy');
      res.body.client.should.not.have.property('members');
      res.body.stats.should.have.property('totalAccesses').eql(0);
      res.body.stats.should.have.property('boardCount').eql(1);
      res.body.stats.should.have.property('isExpired').eql(false);
      res.body.stats.should.have.property('daysUntilExpiry');
    });

    it('it should NOT GET statistics for a client the user is not a member of', async function () {
      const res = await request(server)
        .get('/access/me/clients/mystats-01/stats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Client not found');
    });

    it('it should return 404 for non-existent slug', async function () {
      const res = await request(server)
        .get('/access/me/clients/nonexistent/stats')
        .set('Authorization', `Bearer ${regularUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      res.body.should.have.property('message').eql('Client not found');
    });

    it('it should NOT GET stats without authorization', async function () {
      await request(server)
        .get('/access/me/clients/mystats-01/stats')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });
});
