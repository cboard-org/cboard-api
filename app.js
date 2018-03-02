"use strict";

var cors = require("cors");

var app = require("express")(cors);
var swaggerTools = require("swagger-tools");
var YAML = require("yamljs");
var auth = require("./api/helpers/auth");
var swaggerConfig = YAML.load("./api/swagger/swagger.yaml");
var db = require("./db");
var session = require("express-session");
var MongoStore = require("connect-mongo")(session);

const config = require("./config");

module.exports = app; // for testing

swaggerTools.initializeMiddleware(swaggerConfig, function(middleware) {
  //Serves the Swagger UI on /docs
  app.use(middleware.swaggerMetadata()); // needs to go BEFORE swaggerSecurity
  app.use(
    middleware.swaggerSecurity({
      //manage token function in the 'auth' module
      Bearer: auth.verifyToken
    })
  );
  //use sessions for tracking logins
  app.use(
    session({
      secret: "work hard",
      resave: true,
      saveUninitialized: false,
      store: new MongoStore({
        mongooseConnection: db
      })
    })
  );

  var routerConfig = {
    controllers: "./api/controllers",
    useStubs: false,
    ignoreMissingHandlers: true
  };

  app.use(middleware.swaggerRouter(routerConfig));

  app.use(middleware.swaggerUi());

  var port = process.env.PORT || 10010;
  app.listen(port, function() {
    console.log("Started server on port " + port);
  });
});
