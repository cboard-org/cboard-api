process.env.NODE_ENV = 'test';

const request = require('supertest');
const chai = require('chai');

const helper = require('../helper');

//Parent block
describe('Updates API calls', function () {
  let server;

  before(async function () {
    server = require('../../app'); 
  });


  describe('GET /updates', function () {
    it('it should return a list of updates', async function () {
      const res = await request(server)
        .get('/updates')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const updates = res.body;
      updates.should.be.an('array');

      updates.forEach((update) => {
        update.should.be.an('object').with.all.keys(
          'id',
          'title',
          'content',
          'time'
        );

        // Example assertions for property types
        update.id.should.be.a('string');
        update.title.should.be.a('string');
        update.content.should.be.a('string');
        update.time.should.be.a('string').and.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
        // Add more assertions for other property types
      });

      // Add more global assertions if needed
    });
  });
});
