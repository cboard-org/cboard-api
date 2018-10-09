'use strict';

const constants = require('../constants');

module.exports = {
  env: 'production',
  databaseUrl: process.env.MONGO_URL || 'mongodb://localhost/cboard-api',
  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: process.env.JWT_ISSUER || constants.JWT_DEFAULT_ISSUER
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
