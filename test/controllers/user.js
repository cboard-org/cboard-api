process.env.NODE_ENV = 'test';

const request = require('supertest');
const chai = require('chai');
const expect = chai.expect;

const uuid = require('uuid');

const helper = require('../helper');

const User = require('../../api/models/User');

//Parent block
describe('User API calls', function () {
  let server;

  before(async function () {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
  });

  after(async function () {
    helper.prepareNodemailerMock(true); //disable mockery
    await helper.deleteMochaUsers();
    await User.deleteMany({ name: 'testAlice' });
  });

  describe('POST /user create User', function () {
    let url;

    it('it should to create a new temporary user', async function () {
      const data = {
        ...helper.userData,
        email: helper.generateEmail(),
      };
      const res = await request(server).post('/user').send(data).expect(200);

      const URLLenght = 16;
      url = res.body.url;
      url.should.be.a('string').with.lengthOf(URLLenght); //nev.options.URLLenght
    });

    it('it should to activate user', async function () {
      const res = await request(server)
        .post(`/user/activate/${url}`)
        .expect('Content-Type', /json/)
        .expect(200);

      userid = res.body.userid;
      userid.should.be.a('string');
      userid.should.not.have.string(' '); //is not recomended negate assertions
    });
  });

  describe('POST /user/login', function () {
    it('it should NOT Returns a valid token for a wrong email or password', async function () {
      await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      const wrongUserData = {
        ...helper.userData,
        password: 'wrongPassword',
      };

      const res = await request(server)
        .post('/user/login')
        .send(wrongUserData)
        .expect('Content-Type', /json/)
        .expect(401);

      const authToken = res.body.authToken;
      (authToken === undefined).should.be.true;
      res.body.message.should.be.string;
    });

    it('it should Returns a valid token for a user', async function () {
      const userEmail = helper.generateEmail();
      await helper.prepareUser(server, {
        role: 'user',
        email: userEmail,
      });
      const userData = {
        ...helper.userData,
        email: userEmail,
      };

      const res = await request(server)
        .post('/user/login')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(200);

      const authToken = res.body.authToken;
      authToken.should.be.a('string');
      authToken.should.not.have.string(' ');
      describe('POST /user/login', function () {
        it('it should contain a field indicating that is first login', function () {
          res.body.isFirstLogin.should.be.true;
        });

        it('it should contain a field indicating the user created date', function() {
          res.body.should.to.have.property('createdAt');
        })

        it('it should contain a field indicating if user is on try period', function() {
          res.body.should.to.have.property('isOnTryPeriod');
          res.body.isOnTryPeriod.should.be.true;
        })
      });
    });
  });

  describe('GET /user', function () {
    it('it should NOT Get the full users list without Bearer Token', async function () {
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

  describe('GET /user/:userId', function () {
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

  describe('PUT /user/:userId', function () {
    it('only allows an admin user to update another user', async function () {
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
          message: 'You are not authorized to update this user.',
        })
        .expect(403);

      // Try to update another user as an admin user.
      // This should succeed.
      await request(server)
        .put(`/user/${user.userId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
    });

    it('only allows updating a subset of fields', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      const update = {
        // Updateable.
        //email: 'alice@example.com',  //until resolve issue #140
        name: 'testAlice',
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

      //expect(res.body.email).to.equal(update.email);
      expect(res.body.name).to.equal(update.name);
      expect(res.body.birthdate).to.contain(update.birthdate);
      expect(res.body.locale).to.equal(update.locale);

      expect(res.body.role).to.equal('user');
      expect(res.body.password).not.to.equal(update.password);
    });
  });

  describe('POST /user/logout', function () {
    it('it should Destroys user session and authentication token', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      await request(server)
        .post('/user/logout')
        .send(user)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    });
  });

  describe('POST /user/forgot', function () {
    it('it should NOT create a Clear token to restore password for a wrong email', async function () {
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
      await helper.prepareUser(server, {
        role: 'user',
        email: userEmail,
      });
      const res = await request(server)
        .post('/user/forgot')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send({ email: userEmail })
        .expect(200);

      const userAndUrl = res.body;
      userAndUrl.should.be
        .a('object')
        .with.all.keys('success', 'userid', 'url', 'message');
    });
  });

  describe.skip('POST /user/store-password', function () {
    it('it should NOT allows to store a new password posting /user/forgot and sending data without a verification url.', async function () {
      const userEmail = helper.generateEmail();
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: userEmail,
      });
      await request(server)
        .post('/user/logout')
        .send(user)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
      const getVerificationUrl = await request(server)
        .post('/user/forgot')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send({ email: userEmail })
        .expect(200);

      const userid = getVerificationUrl.body.userid;
      const userStorePassword = {
        userid: userid,
        password: 'newPassword',
        token: '',
      };

      await request(server)
        .post('/user/store-password')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send(userStorePassword)
        .expect(500);
    });

    it('it should NOT allows to store a new password without a verification url.', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      const userStorePassword = { ...user, password: 'newPassword' };

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
      await helper.prepareUser(server, {
        role: 'user',
        email: userEmail,
      });
      const getVerificationUrl = await request(server)
        .post('/user/forgot')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send({ email: userEmail })
        .expect(200);

      const verificationUrl = getVerificationUrl.body.url;
      const userid = getVerificationUrl.body.userid;
      const userStorePassword = {
        userid: userid,
        password: 'newPassword',
        token: verificationUrl,
      };

      const storePasswordRes = await request(server)
        .post('/user/store-password')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send(userStorePassword)
        .expect(200);

      storePasswordRes.body.should.to.have.all.keys(
        'success',
        'url',
        'message'
      );
    });
  });

  describe('DELETE /user/:userid', function () {
    it('it should not delete a user with a user Auth token', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });

      expect(await User.exists({ _id: user.userId })).to.equal(true);

      const res = await request(server)
        .del(`/user/${user.userId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(403);

      expect(await User.exists({ _id: user.userId })).to.equal(true);
    });

    it('it should delete a user', async function () {
      const admin = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.generateEmail(),
      });
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
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
