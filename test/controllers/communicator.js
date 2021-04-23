const request = require('supertest');
const chai = require('chai');

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
  });

  describe('get /communicator', function () {
    it('it should to get the full communicator list', async function () {
      res = await request(server)
        .get('/communicator')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
      helper.verifyListProperties(res.body);
    });
  });

  describe('get /communicator/:communicatorid', function () {
    before(async function () {
      this.communicatorid = await helper.createCommunicator(server, user.token);
    });

    it('it should to NOT get specific communicator without auth', async function () {
      const res = await request(server)
        .get(`/communicator/${this.communicatorid}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should to get specific communicator', async function () {
      const res = await request(server)
        .get(`/communicator/${this.communicatorid}`)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyCommunicatorProperties(res.body);
    });
  });

  describe('put /communicator/:communicatorid', function () {
    before(async function () {
      this.communicatorid = await helper.createCommunicator(server, user.token);
    });

    it('it should NOT update communicator without auth', async function () {
      request(server)
        .put(`/communicator/${this.communicatorid}`)
        .set('Accept', 'application/json')
        .send(helper.communicatorData)
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should update communicator', async function () {
      const newCommunicatorData = { ...helper.communicatorData };
      const updateName = 'mocha update';
      newCommunicatorData.name = updateName;
      const res = await request(server)
        .put(`/communicator/${this.communicatorid}`)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .send(newCommunicatorData)
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyCommunicatorProperties(res.body);
      res.body.name.should.be.equal(updateName);
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
  });

  describe('DELETE /communicator/:communicatorid', function () {
    before(async function () {
      this.communicatorid = await helper.createCommunicator(server, user.token);
      this.userAdmin = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.adminData.email,
      });
    });

    it('it should NOT delete specific communicator without auth', async function () {
      await request(server)
        .del(`/communicator/${this.communicatorid}`)
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

    it('it should to delete specific communicator', async function () {
      //the owner of the communicator cant delete it
      await request(server)
        .del(`/communicator/${this.communicatorid}`)
        .set('Authorization', `Bearer ${this.userAdmin.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
      helper.verifyListProperties(res.body);
    });

    it('it should NOT DELETE a communicator that was already removed', async function () {
      await request(server)
        .del(`/communicator/${this.communicatorid}`)
        .set('Authorization', `Bearer ${this.userAdmin.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);
    });
  });
});
