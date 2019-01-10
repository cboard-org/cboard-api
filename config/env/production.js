'use strict';

const constants = require('../constants');

module.exports = {
  env: 'production',
  databaseUrl: process.env.MONGO_URL || 'mongodb://localhost/cboard-api',
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
    from: 'cboard@cboard.io',
    host: 'smtp.sendgrid.net',
    port: 465,
    secure: true,
    service: 'Sendgrid',
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY
    }
  }
};
