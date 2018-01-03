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
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'martinbedouret@gmail.com',
            pass: 'donttell'
        }
    }
    });
/**
 * Expose
 */

module.exports = {
  development: Object.assign({}, defaults, development)
}[process.env.NODE_ENV || 'development'];
