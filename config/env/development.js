'use strict';

const constants = require('../constants');

module.exports = {
  env: 'development',
  databaseUrl: process.env.MONGO_URL || 'mongodb://localhost/cboard-api',
  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: process.env.JWT_ISSUER || constants.JWT_DEFAULT_ISSUER
  },
  emailTransport: {
    service: 'Gmail',
    from: process.env.DEV_ENV_EMAIL_USER || 'cboardorg@gmail.com',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.DEV_ENV_EMAIL_USER || 'cboardorg@gmail.com',
      pass: process.env.DEV_ENV_EMAIL_PASS || 'Auth1234'
    }
  }
};
