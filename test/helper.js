//Require the dev-dependencies
const chai = require('chai');
const { Express } = require('express');
const mongoose = require('mongoose');
const { token } = require('morgan');
var request = require('supertest');
const User = require('../api/models/User');
const should = chai.should();
const uuid = require('uuid');
const Subscription = require('../api/models/subscriptions');
const Subscriber = require('../api/models/Subscribers');

/**helper nodemailer-mock
 *
 * Prepare nodemailer-mock for not sent emails.
 * @typedef {Object} prepareNodemailerMock

/**
 * Create a test user and generate a token for them.
 *
 * @param {bool} isDisabling -optional to disable mock after use it
 * @returns {void}
 */
function prepareNodemailerMock(isDisabling = 0) {
  const mockery = require('mockery');
  const nodemailerMock = require('nodemailer-mock');
  if (isDisabling) {
    mockery.disable();
    return;
  }

  mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false,
  });

  mockery.registerMock('nodemailer', nodemailerMock);
}

/*should properties helper*/

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

const verifyCommunicatorProperties = (body) => {
  body.should.to.have.all.keys(
    'id',
    'name',
    'email',
    'author',
    'rootBoard',
    'boards'
  );
};

/**
 * Data Mocks to use on test
 */

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
  email: userData.email,
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

const settingsData = {
  language: { lang: 'es-ES' },
  speech: {
    voiceURI:
      'urn:moz-tts:sapi:Microsoft Helena Desktop - Spanish (Spain)?es-ES',
    pitch: 1,
    rate: 0.75,
  },
  display: {
    uiSize: 'Large',
    fontSize: 'Standard',
    hideOutputActive: false,
    labelPosition: 'Above',
    darkThemeActive: true,
  },
  scanning: { active: false, delay: 3000, strategy: 'automatic' },
  navigation: {
    active: false,
    caBackButtonActive: false,
    quickUnlockActive: false,
    removeOutputActive: true,
    vocalizeFolders: false,
  },
};

const translateData = {
  labels: ['translate this'],
  from: 'zu-ZA',
  to: 'zh-CN',
};

const analyticsReportData = [
  {
    clientId: 'test.mocha',
    dimension: 'nthDay',
    metric: 'avgSessionDuration',
    endDate: 'today',
    mobileView: false,
    startDate: '30daysago',
  },
];

const communicatorData = {
  id: 'root',
  name: 'home',
  email: userData.email,
  author: 'cboard mocha test',
  rootBoard: 'root',
  boards: ['root'],
};

const subscriber = {
  subscriberData: {
    country: 'United States',
    status: 'free-trial',
    product: {
      planId: 'one_year_subscription',
      subscriptionId: '123456',
      status: 'requested',
    },
  },

  transactionData: {
    additionalData: null,
    alias: 'One Year Subscription',
    currency: 'USD',
    description: 'annual subscription',
    id: 'one_year_subscription',
    loaded: true,
    price: '$12.99',
    priceMicros: 12990000,
    state: 'approved',
    title: 'The Monthly Subscription Title',
    transaction: {
      developerPayload: null,
      id: 'idString',
      purchaseToken: 'purchaseTokenString',
      // NOTE: receipt's value is string and will need to be parsed
      receipt: `{
    "autoRenewing":true,
    "orderId":"orderIdString",
    "packageName":"com.unicef.cboard",
    "purchaseTime":1555217574101,
    "purchaseState":0,
    "purchaseToken":"purchaseTokenString"
    }`,
      signature: 'signatureString',
      type: 'android-playstore',
    },
  },
  createSubscriber: async (userId) => {
    const newSubscriber = subscriber.subscriberData;
    const actualMoment = '2022-11-01T14:51:15.000Z';
    newSubscriber.userId = userId;
    newSubscriber.createdAt = actualMoment;
    newSubscriber.updatedAt = actualMoment;
    newSubscriber.product.createdAt = actualMoment;
    newSubscriber.product.updatedAt = actualMoment;
    const createdSubscriber = new Subscriber(newSubscriber);
    return await createdSubscriber.save();
  },
  deleteSubscriber: async (userId) => {
    return await Subscriber.deleteMany({ userId });
  },
};

const subscription = {
  subscriptionId: 'subscription-id',
  subscriptionData: {
    name: 'mock subscription',
    status: 'active',
    platform: 'android-playstore',
    benefits: ['feature', 'feature2', 'feature3'],
    plans: [
      {
        name: 'mocked plan',
        planId: 'mocked-plan-id',
        status: 'active',
        countries: ['Argentina'],
        period: 'unlimited',
        renovation: 'anual',
      },
    ],
  },
  updateSubscriptionData: {
    name: 'mock subscription',
    status: 'active',
    platform: 'android-playstore',
    benefits: ['feature4', 'feature5', 'feature6'],
    plans: [
      {
        name: 'updated mocked plan',
        planId: 'updated-mocked-plan-id',
        status: 'active',
        countries: ['Argentina', 'Perú'],
        period: 'unlimited',
        renovation: 'anual',
      },
    ],
  },
  createSubscription: async () => {
    const moment = '2022-11-01T14:51:15.000Z';
    const { subscriptionData, subscriptionId } = subscription;
    const plansWithMoment = subscriptionData.plans.map((plan) => ({
      ...plan,
      createdAt: moment,
      updatedAt: moment,
    }));
    const newSubscription = {
      ...subscriptionData,
      plans: plansWithMoment,
      subscriptionId: subscriptionId,
      createdAt: moment,
      updatedAt: moment,
    };
    const mockedSubscription = new Subscription(newSubscription);
    await mockedSubscription.save();
  },
  deleteSubscription: async () => {
    await Subscription.findOneAndRemove({
      subscriptionId: subscription.subscriptionId,
    });
  },
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

/*generate email to create new users*/
function generateEmail() {
  return `test.${uuid.v4()}@example.com`;
}

/*clean test users*/
async function deleteMochaUsers() {
  await User.deleteMany({ name: 'cboard mocha test' });
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

/**
 * A newly created test Communicator.
 * @typedef {Object} createCommunicatorResponse
 *
 * @property {string} communicatorid
 */

/**
 * Create a Comunicator and return an id.
 *
 * @param {Express} server
 * @param {token}  userToken
 *
 * @returns {Promise<createCommunicatorResponse>}
 */
async function createCommunicator(server, userToken) {
  const createCommunicator = await request(server)
    .post('/communicator')
    .set('Authorization', `Bearer ${userToken}`)
    .send(communicatorData)
    .expect(200);
  return createCommunicator.body.id;
}

/**
 * A newly created test Board.
 * @typedef {Object} createMochaBoard
 *
 * @property {string} BoardId
 */

/**
 * Create a test Board and return the id.
 *
 * @param {Express} server
 *
 * @param {string} token
 *   user data.
 *
 * @returns {Promise<createMochaBoard>}
 */

async function createMochaBoard(server, token) {
  const res = await request(server)
    .post('/board')
    .send(boardData)
    .set('Authorization', `Bearer ${token}`);
  return res.body.id;
}

/* Get the public IP of the device that is running the test */

async function getPublicIp() { 
  const https = require('https');

  const url = 'https://api64.ipify.org?format=json'

  return new Promise((resolve, reject) => {
    var data = '';
    https.get(url, res => {
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        const parse = JSON.parse(data);
        if(parse.ip)
          return resolve(parse.ip);
        return reject();
      })
    })
  });
}

module.exports = {
  prepareNodemailerMock,
  verifyListProperties,
  verifyBoardProperties,
  verifyUserProperties,
  verifyCommunicatorProperties,
  prepareDb,
  prepareUser,
  deleteMochaUsers,
  createCommunicator,
  createMochaBoard,
  boardData,
  communicatorData,
  adminData,
  userData,
  userForgotPassword,
  analyticsReportData,
  settingsData,
  translateData,
  subscription,
  subscriber,
  generateEmail: generateEmail,
  getPublicIp,
};
