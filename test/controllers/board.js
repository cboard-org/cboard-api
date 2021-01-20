//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
const chai = require('chai');
const chaiHttp = require('chai-http');
const { check } = require("prettier");
const should = chai.should();

const server = require('../../app');
const helper = require('../helper');


//Parent block
chai.use(chaiHttp);
describe('Board API calls', () => {

  before((done) => { //Before all we empty the database
    helper.prepareDb(server,done);
  });

  describe('GET /board', () => {
    /* 
        it('it should POST a board', (done) => {
          chai.request(server)
            .post('/board')
            .send(helper.board)
            .end((err, res) => {
              res.should.have.status(200);
              done();
            });
        });
     */
    it('it should GET all the boards', (done) => {
      chai.request(server)
        .get('/board')
        .end((err, res) => {
          res.should.have.status(200);
          done();
        });
    });
  });
});