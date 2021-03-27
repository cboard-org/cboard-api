//Require the dev-dependencies
const chai = require('chai');
const mongoose = require('mongoose');
const { token } = require('morgan');
var request = require('supertest');
const user = require('../api/controllers/user');
const should = chai.should();

const User = require('../api/models/User');

const verifyListProperties = (body) => {
  body.should.be.a('object');
  body.should.to.have.all.keys(
    'total',
    'page',
    'limit',
    'offset',
    'sort',
    'search',
    'data'
  );
};

const verifyBoardProperties = (body) => {
  body.should.be.a('object');
  body.should.have.property('id');
  body.should.have.property('name');
  body.should.have.property('author');
  body.should.have.property('email');
  body.should.have.property('isPublic');
  body.should.have.property('tiles');
};

const verifyUserProperties = (user) => {
  user.should.be.a('object');
  user.should.have.property('id');
  user.should.have.property('name');
  user.should.have.property('email');
  user.should.have.property('password');
};

const userData = {
  name: 'cboard mocha test',
  email: 'anything@cboard.io',
  password: '123456',
};

let userid = '';

let userForgotPassword = {
  Userid: '',
  token: '',
  password: 'newpassword',
};

const boardData = {
  id: 'root',
  name: 'home',
  author: 'cboard mocha test',
  email: 'anything@cboard.io',
  isPublic: true,
  hidden: false,
  tiles: [
    {
      labelKey: 'cboard.symbol.yes',
      image: '/symbols/mulberry/correct.svg',
      id: 'HJVQMR9pX5F-',
      backgroundColor: 'rgb(255, 241, 118)',
      label: 'yes',
    },
    {
      labelKey: 'symbol.descriptiveState.no',
      image: '/symbols/mulberry/no.svg',
      id: 'SkBQMRqpX5t-',
      backgroundColor: 'rgb(255, 241, 118)',
      label: 'no',
    },
  ],
};

function prepareDb() {
  mongoose.connect('mongodb://127.0.0.1:27017/cboard-api', {
    useNewUrlParser: true,
  });
  const connection = mongoose.connection;

  return new Promise((resolve, reject) => {
    connection.once('open', function () {
      mongoose.connection.db.dropDatabase(function (err, result) {
        console.log('Database droped');
        resolve(true);
      });
    });
  });
}

function prepareUser(server) {
  var token;
  var url;
  return new Promise((resolve, reject) => {
    request(server)
      .post('/user')
      .send(userData)
      .expect(200)
      .expect(function (res) {
        url = res.body.url;
      })
      .end(function () {
        request(server)
          .post('/user/activate/' + url)
          .send('')
          .expect(200)
          .end(function (err, res) {
            userid = res.body.userid;
            request(server)
              .post('/user/login')
              .send(userData)
              .expect(200)
              .expect(function (res) {
                token = res.body.authToken;
              })
              .end(function () {
                resolve(token, userid);
              });
          });
      });
  });
}

async function deleteMochaUser() {
  return User.deleteOne({ email: userData.email });
}

module.exports = {
  verifyListProperties,
  verifyBoardProperties,
  verifyUserProperties,
  prepareDb,
  prepareUser,
  deleteMochaUser,
  boardData,
  userData,
  userForgotPassword,
};
