'use strict';

require('dotenv').config();

const cors = require('cors');
const express = require('express');
const swaggerTools = require('swagger-tools');
const YAML = require('yamljs');
const https = require('https');
const pem = require('pem');
const auth = require('./api/helpers/auth');
const swaggerConfig = YAML.load('./api/swagger/swagger.yaml');
const db = require('./db');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const User = require('./api/models/User');
const Facebook = require('./api/passport/facebook');
const Google = require('./api/passport/google');

const config = require('./config');

const app = express();

swaggerTools.initializeMiddleware(swaggerConfig, async function(middleware) {
  //Serves the Swagger UI on /docs
  app.use(cors());
  app.use(middleware.swaggerMetadata()); // needs to go BEFORE swaggerSecurity
  app.use(
    middleware.swaggerSecurity({
      // Manage token function and authorization in the 'auth' module
      Bearer: async (req, authOrSecDef, token, cb) => {
        let isRequestValid = false;
        let errorMessage = 'Not valid token';
        const tokenIsValid = auth.verifyToken(req, token);

        if (tokenIsValid) {
          errorMessage = `Could not found user #${req.auth.id}`;
          const user = await User.getById(req.auth.id);

          if (user) {
            // For previous users that doesn't have any role selected.
            if (!user.role) {
              user.role = 'user';
              await User.updateUser(user);
            }

            req.user = user;

            errorMessage = 'Not authorized';
            isRequestValid = auth.authorizeRequest(req, user);
          }
        }

        if (!isRequestValid) {
          const authorizationError = new Error(errorMessage);
          authorizationError.statusCode = 403;
          cb(authorizationError);
          return req.res.status(403).json({ message: errorMessage });
        }

        cb();
      }
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

  const routerConfig = {
    controllers: './api/controllers',
    useStubs: false,
    ignoreMissingHandlers: true
  };

  app.use(middleware.swaggerRouter(routerConfig));

  app.use(middleware.swaggerUi());

  Facebook.configureFacebookStrategy(app);
  Google.configureGoogleStrategy(app);
  startServer(app);
});

async function startServer(app) {
  let server = app;

  const HTTPS = process.env.DEV_ENV_WITH_HTTPS
    ? parseInt(process.env.DEV_ENV_WITH_HTTPS, 10)
    : false;
  if (HTTPS) {
    console.log('*** Dev Server = HTTPS Enabled ***');
    try {
      server = await new Promise((resolve, reject) => {
        pem.createCertificate({ days: 365, selfSigned: true }, function(
          err,
          keys
        ) {
          if (err) {
            reject(err);
          }
          server = https.createServer(
            { key: keys.serviceKey, cert: keys.certificate },
            server
          );
          resolve(server);
        });
      });
    } catch (e) {
      console.error('Could not create HTTPS Server:', e);
    }
    console.log('******* HTTPS ********');
  }

  const port = process.env.PORT || 10010;
  server.listen(port, function() {
    console.log('Started server on port ' + port);
  });
}
