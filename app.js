'use strict';

var SwaggerExpress = require('swagger-express-mw');
var app = require('express')();
var swaggerTools = require('swagger-tools');
var YAML = require('yamljs');
const config = require('./config');
module.exports = app; // for testing

var swaggerConfig = {
  appRoot: __dirname // required config,
};

/*bbdd configuration in its own file*/
require('./db');

SwaggerExpress.create(swaggerConfig, function(err, swaggerExpress) {
  if (err) { throw err; }

  // install middleware
  swaggerExpress.register(app);

  var port = process.env.PORT || 10010;
  app.listen(port);

});
