process.env.NODE_ENV = 'test';

const request = require('supertest');
const chai = require('chai');

const helper = require('../helper');

//Parent block
describe('Settings API calls', function () {
  let user;
  let server;

  before(async function () {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
    helper.userData.email = helper.generateEmail();
    user = await helper.prepareUser(server, {
      role: 'user',
      email: helper.userData.email
    });
  });

  after(async function () {
    helper.prepareNodemailerMock(true); //disable mockery
    helper.deleteMochaUsers();
  });

  describe('POST /settings', function () {
    it('it should creates or updates a user s settings object in database.', async function () {
      const res = await request(server)
        .post('/settings')
        .send(helper.settingsData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const settingsRes = res.body;
      settingsRes.user.should.to.equal(user.userId);
      settingsRes.language.should.to.deep.equal(helper.settingsData.language);
      settingsRes.speech.should.to.deep.equal(helper.settingsData.speech);
      settingsRes.display.should.to.deep.equal(helper.settingsData.display);
      settingsRes.scanning.should.to.deep.equal(helper.settingsData.scanning);
      settingsRes.navigation.should.to.deep.equal(
        helper.settingsData.navigation
      );
    });

    it('it should NOT creates or updates a user s settings object in database without auth.', async function () {
      const res = await request(server)
        .post('/settings')
        .send(helper.settingsData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });

  describe('GET /settings', function () {
    before(async function(){
      const res = await request(server)
        .post('/settings')
        .send(helper.settingsData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
      console.log(res.body);  
    });

    it('it should Returns settings for current user', async function () {
      const res = await request(server)
        .get('/settings')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      res.body.should.be
        .a('object')
        .with.all.keys(
          'id',
          'language',
          'speech',
          'display',
          'scanning',
          'navigation',
          'user'
        );
    });

    it('it should NOT Returns settings for current user without auth.', async function () {
      await request(server)
        .get('/settings')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });
});
