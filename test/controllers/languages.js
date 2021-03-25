const request = require('supertest');
const chai = require('chai');

const server = require('../../app');
const helper = require('../helper');

//Parent block
describe('Languages API calls', function () {
  let lang;

  it('it should return the full Language list.', function (done) {
    request(server)
      .get('/languages')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        helper.verifyListProperties(res.body);
        lang = res.body.data[0].locale;
        done();
      });
  });

  it('it should Not return a specific language for a unadmitted lang', function (done) {
    const unadmittedLang = 'unadmitted';
    request(server)
      .get('/languages/' + unadmittedLang)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .end(function (err, res) {
        if (err) done(err);
        const errorMessage = res.body.message;
        errorMessage.should.be.a('string');
        done();
      });
  });

  it('it should return a specific language', function (done) {
    request(server)
      .get('/languages/' + lang)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) done(err);
        const languasRes = res.body;
        languasRes.should.to.have.any.keys('locale', 'displayName');
        done();
      });
  });
});
