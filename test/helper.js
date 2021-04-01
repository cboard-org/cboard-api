//Require the dev-dependencies
const chai = require('chai');
const { Express } = require('express');
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
  email: 'anythingUser@cboard.io',
  password: '123456',
};

const adminData = {
  name: 'cboard admin mocha test',
  email: 'anythingAdmin@cboard.io',
  password: '123456',
};

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

function generateEmail() {
  return `test${Date.now()}@example.com`;
}

/**
 * A newly created test user.
 * @typedef {Object} PrepareUserResponse
 *
 * @property {string} token
 * @property {string} userId
 */

/**
 * Create a test user and generate a token for them.
 *
 * @param {Express} server
 *
 * @param {Object} options
 * @param {Object} options.overrides - Properties to overwrite the default
 *   user data with.
 *
 * @returns {Promise<PrepareUserResponse>}
 */
async function prepareUser(server, overrides = {}) {
  const data = {
    ...userData,
    ...overrides,
  };

  const createUser = await request(server).post('/user').send(data).expect(200);

  const activationUrl = createUser.body.url;

  const activateUser = await request(server)
    .post(`/user/activate/${activationUrl}`)
    .send('')
    .expect(200);

  const userId = activateUser.body.userid;

  const login = await request(server)
    .post('/user/login')
    .send(data)
    .expect(200);

  const token = login.body.authToken;

  return { token, userId };
}

async function deleteMochaUser() {
  if (await User.exists({ email: userData.email })) {
    await User.deleteOne({ email: userData.email });
  }
  if (await User.exists({ email: adminData.email })) {
    await User.deleteOne({ email: adminData.email });
  }
  return;
}

async function deleteMochaUserById(userid) {
  if (await User.exists({ _id: userid })) {
    await User.deleteOne({ _id: userid });
  }
  return;
}

module.exports = {
  verifyListProperties,
  verifyBoardProperties,
  verifyUserProperties,
  prepareDb,
  prepareUser,
  deleteMochaUser,
  deleteMochaUserById,
  boardData,
  userData,
  adminData,
  userForgotPassword,
  generateEmail: generateEmail,
};
