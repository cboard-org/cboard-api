'use strict';

var mongoose = require('mongoose');
var config = require('./config');

mongoose.connect(config.databaseUrl);
mongoose.connection.on('connected', () => console.log('Connected to ' + config.env + ' database '));
mongoose.connection.on('error', (err) => console.log('Database connection error: ' + err));
mongoose.connection.on('disconnected', () => console.log('Disconnected from database'));

process.on('SIGINT', () => mongoose.connection.close(() => {
    console.log('Finished App and disconnected from database');
    process.exit(0);
}));

module.exports = mongoose.connection;