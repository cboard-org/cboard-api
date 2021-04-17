process.env.NODE_ENV = 'test';

const request = require('supertest');
const chai = require('chai');

const server = require('../../app');
const helper = require('../helper');

//Parent block
describe('Settings API calls', function () {
  let user;

  before(async function () {
    await helper.deleteMochaUser();
    user = await helper.prepareUser(server, {
      role: 'user',
      email: helper.userData.email,
    });
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
    it('it should Returns settings for current user', async function () {
      const res = await request(server)
        .get('/settings')
        .send(helper.settingsData)
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
      const res = await request(server)
        .get('/settings')
        .send(helper.settingsData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });
  });
});
