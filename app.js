'use strict';

var app = require('express')();
var swaggerTools = require('swagger-tools');
var YAML = require('yamljs');
var auth = require('./api/helpers/auth');
var swaggerConfig = YAML.load('./api/swagger/swagger.yaml');
var db = require('./db');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);

const config = require('./config');

module.exports = app; // for testing

swaggerTools.initializeMiddleware(swaggerConfig, function(middleware) {
  // Base middleware that will analyze a request route,
  // match it to an API in your Swagger document(s) and
  // then annotate the request
  app.use(middleware.swaggerMetadata()); // needs to go BEFORE swaggerSecurity

  // This middleware allows you to wire up authentication/auth
  // handlers based on the definitions in your Swagger document(s).
  app.use(
    middleware.swaggerSecurity({
      //manage token function in the 'auth' module
      Bearer: auth.verifyToken
    })
  );
  //use sessions for tracking logins
  app.use(
    session({
      secret: 'work hard',
      resave: true,
      saveUninitialized: false,
      store: new MongoStore({
        mongooseConnection: db
      })
    })
  );

  var routerConfig = {
    controllers: './api/controllers',
    useStubs: false
  };

  app.use(middleware.swaggerRouter(routerConfig));

  app.use(middleware.swaggerUi());

  var port = process.env.PORT || 10010;
  app.listen(port, function() {
    console.log('Started server on port ' + port);
  });
});
