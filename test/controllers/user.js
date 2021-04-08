process.env.NODE_ENV = 'test';

const request = require('supertest');
const chai = require('chai');
const expect = chai.expect;

const uuid = require('uuid');

//Parent block
describe('User API calls', function () {
  const helper = require('../helper');
  helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock

  const server = require('../../app'); //register mocks before require the original dependency
  const User = require('../../api/models/User');

  beforeEach(async function () {
    await helper.deleteMochaUser();
  });
  
  after(async function(){
    helper.disableMockery;
  })

  describe('POST /user create User', function () {
    let url; 
    let userid;

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
        .post(`/user/activate/${url}`)
        .expect('Content-Type', /json/)
        .expect(200);

      userid = res.body.userid;
      userid.should.be.a('string');
      userid.should.not.have.string(' '); //is not recomended negate assertions
    });
  });

  describe('POST /user/login', function () {
    afterEach(async function () {
      await helper.deleteMochaUser();
    });

    it('it should NOT Returns a valid token for a wrong email or password', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.userData.email
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
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.userData.email,
      });
      const userData = {
        ...helper.userData,
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

  describe('GET /user', function () {
    afterEach(async function () {
      await helper.deleteMochaUser();
    });

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
        email: helper.userData.email,
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
    afterEach(async function () {
      await helper.deleteMochaUser();
    });

    it('it should Get a specific user', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.userData.email,
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
    afterEach(async function () {
      await helper.deleteMochaUser();
    });

    it('only allows an admin user to update another user', async function () {
      const admin = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.adminData.email,
      });

      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.userData.email,
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

    it('only allows updating a subset of fields', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.userData.email,
      });

      const update = {
        // Updateable.
        //email: 'alice@example.com',  //until resolve issue #140
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

      //expect(res.body.email).to.equal(update.email);
      expect(res.body.name).to.equal(update.name);
      expect(res.body.birthdate).to.contain(update.birthdate);
      expect(res.body.locale).to.equal(update.locale);

      expect(res.body.role).to.equal('user');
      expect(res.body.password).not.to.equal(update.password);
      await helper.deleteMochaUserById(user.userId); //when email update delete with Id
    });
  });

  describe('POST /user/logout', function () {
    afterEach(async function () {
      await helper.deleteMochaUser();
    });

    it('it should Destroys user session and authentication token', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.userData.email,
      });

      const res = await request(server)
        .post('/user/logout')
        .send(user)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    });
  });

  describe('POST /user/forgot', function () {
    afterEach(async function () {
      await helper.deleteMochaUser();
    });

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
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.userData.email,
      });
      const res = await request(server)
        .post('/user/forgot')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send({ email: helper.userData.email })
        .expect(200);

      const userAndUrl = res.body;
      userAndUrl.should.be
        .a('object')
        .with.all.keys('success', 'userid', 'url', 'message');
    });
  });
  describe('POST /user/store-password', function () {
    afterEach(async function () {
      await helper.deleteMochaUser();
    });

    it('it should NOT allows to store a new password without a verification url.', async function () {
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.userData.email,
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
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.userData.email,
      });
      const getVerificationUrl = await request(server)
        .post('/user/forgot')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send({ email: helper.userData.email })
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
    afterEach(async function () {
      await helper.deleteMochaUser();
    });

    it('it should delete a user', async function () {
      const admin = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.adminData.email,
      });
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.userData.email,
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
