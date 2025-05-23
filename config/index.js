const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env.development')
});

const development = require('./env/development');
const production = require('./env/production');
const defaults = {
  host: process.env.HOST || 'mongodb',
  port: process.env.PORT || 8100
};

function getConfig() {
  var config = null;
  switch (process.env.NODE_ENV) {
    case 'development':
      return (config = Object.assign({}, defaults, development));
    case 'production':
      return (config = Object.assign({}, defaults, production));
    default:
      return (config = Object.assign({}, defaults, development));
  }
}

/**
 * Expose
 */
module.exports = getConfig();
