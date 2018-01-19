//require('babel-polyfill');
const path = require('path');

const development = require('./env/development');

const defaults = {
  host: process.env.HOST || 'mongodb',
  port: process.env.PORT || 8100,
  materialsDir: path.join( process.cwd(), 'materials' ),
  jwtSecret: 'asdfgASDFG12345'
};

/**
 * Expose
 */

module.exports = {
  development: Object.assign({}, defaults, development)
}[process.env.NODE_ENV || 'development'];
