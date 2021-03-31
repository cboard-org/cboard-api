'use strict';

const constants = require('../constants');

module.exports = {
  env: 'testing',
  databaseUrl: process.env.MONGO_URL || 'mongodb://localhost/cboard-api',
  session: {
    secret: process.env.API_SESSION_SECRET || 's3Cur3'
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: process.env.JWT_ISSUER || constants.JWT_DEFAULT_ISSUER
  },
  facebook: {
    APP_ID: process.env.FACEBOOK_APP_ID,
    APP_SECRET: process.env.FACEBOOK_APP_SECRET,
    CALLBACK_URL: process.env.FACEBOOK_CALLBACK_URL,
    PROFILE_FIELDS: [
      'id',
      'emails',
      'name',
      'displayName',
      'gender',
      'picture'
    ],
    SCOPE: ['public_profile', 'email']
  },
  google: {
    APP_ID: process.env.GOOGLE_APP_ID,
    APP_SECRET: process.env.GOOGLE_APP_SECRET,
    CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    SCOPE: [
      'https://www.googleapis.com/auth/plus.login',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  },
  emailTransport: {
    host: "smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASSWORD
    }
  }
};