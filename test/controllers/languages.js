const request = require('supertest');
const chai = require('chai');

const server = require('../../app');
const helper = require('../helper');

//Parent block
describe('Languages API calls', function () {
  describe('GET /languajes', function () {
    it('it should return the full Language list.', async function () {
      const res = await request(server)
        .get('/languages')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      helper.verifyListProperties(res.body);
    });
  });

  describe('GET /languages/:lang', function () {
    it('it should Not return a specific language for a unadmitted lang', async function () {
      const unadmittedLang = 'unadmitted';
      const res = await request(server)
        .get(`/languages/${unadmittedLang}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);
      const errorMessage = res.body.message;
      errorMessage.should.be.a('string');
    });

    it('it should return a specific language', async function () {
      let lang = 'zu-ZA'; //one supported languaje
      const res = await request(server)
        .get(`/languages/${lang}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const languasRes = res.body;
      languasRes.should.to.have.any.keys('locale', 'displayName');
    });
  });
});
