'use strict';

module.exports = {
  env: 'production',
  databaseUrl: process.env.MONGO_URL || 'mongodb://localhost/cboard-api',
  jwt: {
    secret: process.env.JWT_SECRET
  },
  emailTransport: {
    from: 'cboard@cboard.io',
    host: 'smtp.sendgrid.net',
    port: 2325,
    secure: true,
    service: 'Sendgrid',
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY
    }
  }
};
