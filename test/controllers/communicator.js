const request = require('supertest');
const chai = require('chai');
const should = chai.should();

const Communicator = require('../../api/models/Communicator');

const helper = require('../helper');

//Parent block
describe('Communicator API calls', function () {
  let server;
  let user;

  before(async function () {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
  });

  after(async function () {
    helper.prepareNodemailerMock(true);
    await helper.deleteMochaUsers();
    await Communicator.deleteMany({ author: 'cboard mocha test' });
  });

  beforeEach(async function () {
    helper.communicatorData.email = helper.generateEmail();
    user = await helper.prepareUser(server, {
      role: 'user',
      email: helper.communicatorData.email,
    });
  });

  // Creates the users for an ownership scenario. The owner and its communicator
  // are created in the same scope so the token used in each test belongs to the
  // communicator owner (the parent beforeEach creates a new, unrelated user for
  // every test).
  async function prepareOwnershipScenario() {
    const owner = await helper.prepareUser(server, {
      role: 'user',
      email: helper.generateEmail(),
    });
    const otherUser = await helper.prepareUser(server, {
      role: 'user',
      email: helper.generateEmail(),
    });
    const admin = await helper.prepareUser(server, {
      role: 'admin',
      email: helper.generateEmail(),
    });
    const { body } = await request(server)
      .post('/communicator')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...helper.communicatorData, email: owner.email })
      .expect(200);
    return { owner, otherUser, admin, communicatorId: body.id };
  }

  describe('POST /communicator create Communicator', function () {
    it('it should to create a new communicator', async function () {
      const res = await request(server)
        .post('/communicator')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .send(helper.communicatorData)
        .expect('Content-Type', /json/)
        .expect(200);
      const communicatorRes = res.body;
      communicatorRes.should.to.have.all.keys(
        'success',
        'id',
        'communicator',
        'message'
      );
      this.communicatorid = communicatorRes.id;
      this.communicatorid.should.be.a('string');
    });

    it("it should NOT create a communicator owned by another user", async function () {
      const victim = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      const res = await request(server)
        .post('/communicator')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .send({ ...helper.communicatorData, email: victim.email })
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.communicator.email.should.equal(user.email);
      const stored = await Communicator.findById(res.body.id).lean();
      stored.email.should.equal(user.email);
    });
  });

  describe('get /communicator', function () {
    it('it should NOT get the full communicator list as a non-admin user', async function () {
      await request(server)
        .get('/communicator')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should get the full communicator list as an admin', async function () {
      const admin = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.generateEmail(),
      });

      const res = await request(server)
        .get('/communicator')
        .set('Authorization', `Bearer ${admin.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
      helper.verifyListProperties(res.body);
    });
  });

  describe('get /communicator/:communicatorid', function () {
    let scenario;

    before(async function () {
      scenario = await prepareOwnershipScenario();
    });

    it('it should to NOT get specific communicator without auth', async function () {
      await request(server)
        .get(`/communicator/${scenario.communicatorId}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should to get specific communicator', async function () {
      const res = await request(server)
        .get(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.owner.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyCommunicatorProperties(res.body);
    });

    it("it should NOT get another user's communicator", async function () {
      await request(server)
        .get(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.otherUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);
    });

    it("it should get another user's communicator as an admin", async function () {
      const res = await request(server)
        .get(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.admin.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyCommunicatorProperties(res.body);
    });
  });

  describe('put /communicator/:communicatorid', function () {
    let scenario;

    before(async function () {
      scenario = await prepareOwnershipScenario();
    });

    it('it should NOT update communicator without auth', async function () {
      await request(server)
        .put(`/communicator/${scenario.communicatorId}`)
        .set('Accept', 'application/json')
        .send(helper.communicatorData)
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should update communicator', async function () {
      const updateName = 'mocha update';
      const res = await request(server)
        .put(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.owner.token}`)
        .set('Accept', 'application/json')
        .send({
          ...helper.communicatorData,
          email: scenario.owner.email,
          name: updateName,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyCommunicatorProperties(res.body);
      res.body.name.should.be.equal(updateName);
    });

    it("it should NOT update another user's communicator", async function () {
      const before = await Communicator.findById(scenario.communicatorId).lean();

      await request(server)
        .put(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.otherUser.token}`)
        .set('Accept', 'application/json')
        .send({ ...helper.communicatorData, name: 'edited by another user' })
        .expect('Content-Type', /json/)
        .expect(404);

      const after = await Communicator.findById(scenario.communicatorId).lean();
      after.name.should.equal(before.name);
      after.email.should.equal(scenario.owner.email);
    });

    it("it should update another user's communicator as an admin", async function () {
      const res = await request(server)
        .put(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.admin.token}`)
        .set('Accept', 'application/json')
        .send({
          ...helper.communicatorData,
          email: scenario.owner.email,
          name: 'edited by admin',
        })
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.name.should.equal('edited by admin');
    });

    it('it should NOT change the communicator email for a non-admin owner', async function () {
      const res = await request(server)
        .put(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.owner.token}`)
        .set('Accept', 'application/json')
        .send({
          ...helper.communicatorData,
          email: scenario.otherUser.email,
          name: 'reassign attempt',
        })
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.email.should.equal(scenario.owner.email);
      const stored = await Communicator.findById(scenario.communicatorId).lean();
      stored.email.should.equal(scenario.owner.email);
    });
  });

  describe('GET /communicator/byemail/:userEmail', function () {
    //check this after resolve issue #140
    before(async function () {
      await helper.createCommunicator(server, user.token);
    });

    it('it should NOT get communicators for a specific user email without auth', async function () {
      await request(server)
        .get(`/communicator/byemail/${helper.communicatorData.email}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should get communicators for a specific user email', async function () {
      const res = await request(server)
        .get(`/communicator/byemail/${helper.communicatorData.email}`)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyListProperties(res.body);
    });

    it("only allows an admin to get another user's communicators", async function() {
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

      // Try to get another user's communicators as a regular user.
      // This should fail.
      await request(server)
        .get(`/communicator/byemail/${encodeURI(adminEmail)}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect({
          message: "You are not authorized to get this user's communicators.",
        })
        .expect(403);

      // Try to get another user's communicators as an admin user.
      // This should succeed.
      await request(server)
        .get(`/communicator/byemail/${encodeURI(userEmail)}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);


      // Try to get my own communicators as a regular user.
      // This should succeed.
      await request(server)
        .get(`/communicator/byemail/${encodeURI(userEmail)}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
    });
  });

  describe('DELETE /communicator/:communicatorid', function () {
    let scenario;

    before(async function () {
      scenario = await prepareOwnershipScenario();
    });

    it('it should NOT delete specific communicator without auth', async function () {
      await request(server)
        .del(`/communicator/${scenario.communicatorId}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should NOT delete specific communicator without id', async function () {
      await request(server)
        .del('/communicator/')
        .set('Accept', 'application/json')
        .expect(405);
    });

    // DELETE is admin only (swagger scope), even for the owner.
    it("it should NOT delete another user's communicator as a non-admin", async function () {
      await request(server)
        .del(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.otherUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);

      const stillThere = await Communicator.findById(scenario.communicatorId);
      should.exist(stillThere);
    });

    it('it should NOT delete its own communicator as a non-admin', async function () {
      await request(server)
        .del(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.owner.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);

      const stillThere = await Communicator.findById(scenario.communicatorId);
      should.exist(stillThere);
    });

    it("it should delete another user's communicator as an admin", async function () {
      await request(server)
        .del(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.admin.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    });

    it('it should NOT DELETE a communicator that was already removed', async function () {
      await request(server)
        .del(`/communicator/${scenario.communicatorId}`)
        .set('Authorization', `Bearer ${scenario.admin.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);
    });
  });
});
