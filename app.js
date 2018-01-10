'use strict';

var SwaggerExpress = require('swagger-express-mw');
var app = require('express')();
var swaggerTools = require('swagger-tools');
var YAML = require('yamljs');
var auth = require("./api/helpers/auth");

const config = require('./config');

var swaggerConfig = YAML.load("./api/swagger/swagger.yaml");

module.exports = app; // for testing

//var swaggerConfig = {
//  appRoot: __dirname // required config,
//};

/*bbdd configuration in its own file*/
require('./db');

swaggerTools.initializeMiddleware(swaggerConfig, function(middleware) {
  //Serves the Swagger UI on /docs
  app.use(middleware.swaggerMetadata()); // needs to go BEFORE swaggerSecurity
  
  app.use(
    middleware.swaggerSecurity({
      //manage token function in the 'auth' module
      Bearer: auth.verifyToken
    })
  );
  
  var routerConfig = {
    controllers: "./api/controllers",
    useStubs: false
  };

  app.use(middleware.swaggerRouter(routerConfig));

  app.use(middleware.swaggerUi());
  
  var port = process.env.PORT || 10010;
  app.listen(port, function() {
    console.log("Started server on port 10010");
  });
});

//
//SwaggerExpress.create(swaggerConfig, function(err, swaggerExpress) {
//  if (err) { throw err; }
//
//  // install middleware
//  swaggerExpress.register(app);
//
//  var port = process.env.PORT || 10010;
//  app.listen(port);
//
//});
