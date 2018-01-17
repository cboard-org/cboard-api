'use strict';

var mongoose = require('mongoose');
var config = require('./config');

mongoose.connect('mongodb://martinbedouret:Muni1909@ds253587.mlab.com:53587/cboard');
mongoose.connection.on('connected', () => console.log('Connected to database '));
mongoose.connection.on('error',(err) => console.log('Database connection error: ' + err));
mongoose.connection.on('disconnected', () => console.log('Disconnected from database'));

process.on('SIGINT', () => mongoose.connection.close( () => {
  console.log('Finished App and disconnected from database');
  process.exit(0);
}));