'use strict';

const constants = require('../constants');


module.exports = {
  env: 'production',
  databaseUrl: 'mongodb://10.0.0.4:27017,10.0.0.5:27017,10.0.0.6:27017/cboard-api?replicaSet=repset',
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
  apple: {
    CALLBACK_URL: process.env.APPLE_CALLBACK_URL
  },
  emailTransport: {
    from: 'cboard@cboard.io',
    host: 'smtp.sendgrid.net',
    port: 465,
    secure: false,
    service: 'Sendgrid',
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: "TLSv1.2"
    }
  },
  appInsightConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  GOOGLE_PLAY_CREDENTIALS: process.env.GOOGLE_PLAY_CREDENTIALS,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  PAYPAL_API_URL: 'https://api-m.paypal.com/',
  CBOARD_PROD_URL: 'https://app.cboard.io',
  CBOARD_QA_URL: 'https://app.qa.cboard.io',
  LOCALHOST_PORT_3000_URL: 'http://localhost',
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
  CBUILDER_API_URL: process.env.CBUILDER_APP_URL || 'http://localhost:3000'
};
