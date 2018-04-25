let mongoose = require('mongoose');
let chai = require('chai');
let chaiHttp = require('chai-http');
let server = require('../app');
let User = require('../api/models/User');

let should = chai.should();
chai.use(chaiHttp);

before(done => {
  // Empty the DB before running the tests below
  User.remove({}, err => {
    done();
  });
});

describe('API TESTING', () => {
  let jwt = '';
  let activationURL = '';
  let testID = '';

  describe('/user/login POST', () => {
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

  describe('/user POST', () => {
    it('should send back url and email sent message', done => {
      const user = {
        name: 'jl7897',
        email: 'jacob.lee715@gmail.com',
        password: '1234'
      };
      chai
        .request(server)
        .post('/user')
        .send(user)
        .end((err, res) => {
          activationURL = res.body.url;
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('url');
          res.body.should.have.property('message');
          res.body.should.have.property('success').eql(1);
          done();
        });
    });
  });

  describe('/user/activate/{url} POST', () => {
    it('should return success and user id with confimation message', done => {
      chai
        .request(server)
        .post(`/user/activate/${activationURL}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('success').eql(1);

          // these are what is actually returned (in Postman too) even though it does confirm the user, no idea why
          // res.should.have.status(404);
          // res.body.should.be.a('object');
          // res.body.should.have.property('message').eql('ERROR: confirming temp user FAILED null');
          done();
        });
    });
  });

  describe('/user/login/admin POST', () => {
    it('should return the user profile containing the jwt', done => {
      const user = {
        email: 'jacob.lee715@gmail.com',
        password: '1234'
      };

      chai
        .request(server)
        .post('/user/login/admin')
        .send(user)
        .end((err, res) => {
          jwt = res.body.authToken;
          testID = res.body._id;
          // console.log('###########', res.body);
          // console.log('$$$$$$$$$$$', jwt);
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('authToken');
          done();
          // this obviously is working, but is for some reason not passing like half the time.
          // It is returning my user profile and jwt regardless of failing or passing
          // as intended, and the jwt works as seen in the test below.
          // works the same in postman as well. Not sure what the issue is here
        });
    });
  });

  describe('/user GET', () => {
    it('should send back an array of all users', done => {
      chai
        .request(server)
        .get('/user')
        .set('Authorization', `Bearer ${jwt}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('array');
          res.body.length.should.be.eql(1);
          res.body[0].should.be.a('object');
          done();
        });
    });
  });

  describe('/user/{id} GET', () => {
    it('should send back a specific user', done => {
      chai
        .request(server)
        .get(`/user/${testID}`)
        .set('Authorization', `Bearer ${jwt}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('name').eql('jl7897');
          done();
        });
    });
  });

  describe('/user/{id} PUT', () => {
    it('should update a property on the user', done => {
      const user = {
        name: 'yaBoi'
      };

      chai
        .request(server)
        .put(`/user/${testID}`)
        .set('Authorization', `Bearer ${jwt}`)
        .send(user)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('name').eql('yaBoi');
          done();
        });
    });
  });

  describe('/user/{id} DELETE', () => {
    it('should delete a user out of the database', done => {
      chai
        .request(server)
        .delete(`/user/${testID}`)
        .set('Authorization', `Bearer ${jwt}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('name').eql('yaBoi');
          done();
        });
    });
  });
});
