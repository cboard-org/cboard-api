"use strict";

module.exports = {
    env: 'production',
    databaseUrl: process.env.MONGO_URL || 'mongodb://martinbedouret:Kapsch32065@ds253587.mlab.com:53587/cboard',
    jwt: {
        secret: process.env.JWT_SECRET
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