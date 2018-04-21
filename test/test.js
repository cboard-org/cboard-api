let mongoose = require('mongoose');
let chai = require('chai');
let chaiHttp = require('chai-http');
let server = require('../app');
let User = require('../api/models/User');

let should = chai.should();
chai.use(chaiHttp);

describe('API TEST', () => {
  beforeEach(done => {
    //Before each test we empty the database
    User.remove({}, err => {
      done();
    });
  });
  /*
      * Test the /GET route
      */
  describe('/user/login', () => {
    it('it should send back an error due to no JWT', done => {
      chai
        .request(server)
        .get('/user/login')
        .end((err, res) => {
          res.should.have.status(403);
          done();
        });
    });
  });
});
