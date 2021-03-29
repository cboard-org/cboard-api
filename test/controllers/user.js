process.env.NODE_ENV = 'test';

const request = require('supertest');
const chai = require('chai');
var assert = chai.assert;
const expect = chai.expect;

const uuid = require('uuid');

const server = require('../../app');
const helper = require('../helper');
const { copy } = require('../../app');

const nev = require('../../api/mail/index');
const User = require('../../api/models/User');
const user = require('../../api/controllers/user');

//Parent block
describe('User API calls', function () {
  this.timeout(7000); //some external process take time.
  let authToken;
  let url;
  let userid;

  before(async function() {
    await helper.deleteMochaUser();
  });

  describe('POST /user create User', function(){
    it('it should to create a new temporary user', async function () {
      const res = await request(server)
        .post('/user')
        .send(helper.userData)
        .expect(200);

      const URLLenght = 16;
      url = res.body.url;  
      url.should.be.a('string').with.lengthOf(URLLenght); //nev.options.URLLenght
    });

    it('it should to activate user', async function () {
      const res = await request(server)
        .post('/user/activate/' + url)
        .expect('Content-Type', /json/)
        .expect(200);

      userid = res.body.userid;
      userid.should.be.a('string');
      userid.should.not.have.string(' '); //is not recomended negate assertions
    });
    helper.deleteMochaUser();
  })

  describe('POST /user/login', function(){
    it('it should NOT Returns a valid token for a wrong email or password', async function () {
      const newEmail = helper.generateEmail();
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: newEmail
      });

      const wrongUserData = {
        ...helper.userData,
        email: newEmail,
        password: 'wrongPassword'
      };

      const res = await request (server)
        .post('/user/login')
        .send(wrongUserData)
        .expect('Content-Type', /json/)
        .expect(401)
      
      const authToken = res.body.authToken;
      (authToken === undefined).should.be.true;
      res.body.message.should.be.string;  
    });   

    it('it should Returns a valid token for a user', async function () {
      const newEmail = helper.generateEmail();
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: newEmail,
      });
      const userData = {
        ...helper.userData,
        email: newEmail
      };

      const res = await request(server)
        .post('/user/login')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(200);
      
      const authToken = res.body.authToken;
      authToken.should.be.a('string');
      authToken.should.not.have.string(' ');  
    });
  });

  describe('GET /user', function(){
    it('it should NOT Get the full users list without Bearer Token',async function () {
      await request(server)
        .get('/user')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should Get the full users list', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      const res = await request(server)
        .get('/user')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyListProperties(res.body);
    });
  });

  describe('GET /user/:userId', function(){
    it('it should Get a specific user', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      const res = await request(server)
        .get(`/user/${user.userId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

        const getUser = res.body;
        getUser.should.to.have.any.keys('name', 'role', 'provider', 'email');
    });
  });

  describe('PUT /user/:userId', function() {
    it('only allows an admin user to update another user', async function() {
      const admin = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.generateEmail(),
      });

      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      // Try to update another user as a regular user.
      // This should fail.
      await request(server)
        .put(`/user/${admin.userId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect({
          message: 'Only admins can update another user.',
        })
        .expect(403);

      // Try to update another user as an admin user.
      // This should succeed.
      await request(server)
        .put(`/user/${user.userId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
    });

    it('only allows updating a subset of fields', async function() {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      const update = {
        // Updateable.
        email: 'alice@example.com',
        name: 'Alice',
        birthdate: '2001-10-17',
        locale: 'klingon',

        // Not updateable.
        role: 'foobar',
        password: uuid.v4(),
      };

      const res = await request(server)
        .put(`/user/${user.userId}`)
        .send(update)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(res.body.email).to.equal(update.email);
      expect(res.body.name).to.equal(update.name);
      expect(res.body.birthdate).to.contain(update.birthdate);
      expect(res.body.locale).to.equal(update.locale);

      expect(res.body.role).to.equal('user');
      expect(res.body.password).not.to.equal(update.password);
    });
  });

  describe('POST /user/logout', function() {
    it('it should Destroys user session and authentication token', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      const res = await request(server)
        .post('/user/logout')
        .send(user)
        .set('Authorization', 'Bearer ' + user.token)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      console.log(res.body.message);
    });
  });  

  describe('POST /user/forgot', function() {
    it('it should NOT create a Clear token to restore password for a wrong email', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      let wrongUserEmail = 'wrong_email@wrong.com';
      const res = await request(server)
        .post('/user/forgot')
        .send(wrongUserEmail)
        .expect('Content-Type', /json/)
        .expect(404);
      
      res.body.message.should.be.a('string');  
    });

    it('it should create a Clear token to restore password', async function () {
      const userEmail = helper.generateEmail();
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: userEmail,
      });
      const res = await request(server)
        .post('/user/forgot')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send({email: userEmail})
        .expect(200);

      const userAndUrl = res.body;
      userAndUrl.should.be.a('object').with.all.keys('success', 'userid', 'url', 'message');
    });
  });  
  describe('POST /user/store-password', function() {
    it('it should NOT allows to store a new password without a verification url.', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      const userStorePassword = {...user,
        password: "newPassword"};

      const res = await request(server)
        .post('/user/store-password')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send(userStorePassword)
        .expect(500);

      res.body.message.should.be.a('string'); 
    });

    it('it should allows to store a new password using a verification url.', async function () {
      const userEmail = helper.generateEmail();
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: userEmail,
      });
      const getVerificationUrl = await request(server)
        .post('/user/forgot')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send({email: userEmail})
        .expect(200);

      const verificationUrl =  getVerificationUrl.body.url;
      const userid = getVerificationUrl.body.userid;
      console.log(verificationUrl);
      const userStorePassword = {userid: userid,
        password: "newPassword",
        token: verificationUrl};
      console.log(userStorePassword);  
      const storePasswordRes = await request(server)
        .post('/user/store-password')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send(userStorePassword)
        .expect(200);
      console.log(storePasswordRes.body)
      storePasswordRes.body.should.to.have.all.keys('success', 'url', 'message');
    });
  });  

  describe('DELETE /user/:userid', function() {
    it('it should delete a user', async function() {
      const admin = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.generateEmail(),
      });
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail()
      });

      expect(await User.exists({ _id: user.userId })).to.equal(true);

      const res = await request(server)
        .del(`/user/${user.userId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(await User.exists({ _id: user.userId })).to.equal(false);
    });
  });  
});
