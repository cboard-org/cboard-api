//require('babel-polyfill');
const path = require('path');

const development = require('./env/development');

const defaults = {
  host: process.env.HOST || 'mongodb',
  port: process.env.PORT || 8100,
  materialsDir: path.join( process.cwd(), 'materials' ),
  jwtSecret: 'asdfgASDFG12345'
};

var nodemailer = require('nodemailer');
var smtpTransport = nodemailer.createTransport({
    from: 'martinbedouret@gmail.com',
    options: {
        host: 'smtp.sendgrid.net',
        port: 465,
        secure: true,
        auth: {
            user: 'apikey',
            pass: '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'
        }
    }
    });
/**
 * Expose
 */

module.exports = {
  development: Object.assign({}, defaults, development)
}[process.env.NODE_ENV || 'development'];
