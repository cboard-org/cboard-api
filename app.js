'use strict';

var SwaggerExpress = require('swagger-express-mw');
var app = require('express')();
const config = require('./config');
module.exports = app; // for testing

var swaggerConfig = {
  appRoot: __dirname // required config,
}

/*bbdd configuration in its own file*/
require('./db');

SwaggerExpress.create(swaggerConfig, function(err, swaggerExpress) {
  if (err) { throw err; }

  // install middleware
  swaggerExpress.register(app);

  var port = process.env.PORT || 10010;
  app.listen(port);

  if (swaggerExpress.runner.swagger.paths['/hello']) {
    console.log('try this:\ncurl http://127.0.0.1:' + port + '/hello?name=Scott');
  }
});
