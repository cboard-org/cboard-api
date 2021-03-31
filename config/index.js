
const path = require('path');
const development = require('./env/development');
const production = require('./env/production');
const testing = require('./env/testing');

const defaults = {
  host: process.env.HOST || 'mongodb',
  port: process.env.PORT || 8100
};

function getConfig() {
    var config = null;
    switch(process.env.NODE_ENV) {
        case 'development':
            return config = Object.assign({}, defaults, development);
        case 'production':
            return config  = Object.assign({}, defaults, production);
        case 'testing':
            return config = Object.assign({}, defaults, testing);     
        default:
            return config = Object.assign({}, defaults, development);
    }
};

/**
 * Expose
 */

module.exports = getConfig();
