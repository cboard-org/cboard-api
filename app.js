'use strict';

require('dotenv-defaults').config();

const appInsights = require('applicationinsights');

const cors = require('cors');
const express = require('express');
const swaggerTools = require('swagger-tools');
const YAML = require('yamljs');
const https = require('https');
const pem = require('pem');
const bodyParser = require('body-parser');
const auth = require('./api/helpers/auth');
const swaggerConfig = YAML.load('./api/swagger/swagger.yaml');
const db = require('./db');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const User = require('./api/models/User');
const Facebook = require('./api/passport/facebook');
const Google = require('./api/passport/google');
const GoogleToken = require('./api/passport/googleToken');
const FacebookToken = require('./api/passport/facebookToken');
const Apple = require('./api/passport/apple');
const morgan = require('morgan');
const config = require('./config');

const app = express();

if (config.appInsightConnectionString && config.env === 'production') {
  appInsights
    .setup()
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true,true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true, false)
    .setUseDiskRetryCaching(true)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
    .setSendLiveMetrics(true)

  appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = "Cboard API";
  appInsights.start()

  console.log("Application Insights started");
}

swaggerTools.initializeMiddleware(swaggerConfig, async function (middleware) {
  //Serves the Swagger UI on /docs
  app.use(
    cors({
      origin: [
        process.env.CBOARD_APP_URL,
        process.env.CBOARD_IOS_APP_URL,
        process.env.CBUILDER_APP_URL
      ]
    })
  );

  // Log HTTP requests. The `dev` format looks like this:
  // :method :url :status :response-time ms - :res[content-length]
  app.use(morgan('dev'));

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
  app.use(middleware.swaggerMetadata()); // needs to go BEFORE swaggerSecurity
  app.use('/docs', middleware.swaggerUi());
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
          req.res.status(403).json({ message: errorMessage });
          cb(authorizationError);
          return
        }

        cb();
      }
    })
  );
  //use sessions for tracking logins
  app.use(
    session({
      secret: [config.session.secret, 'work hard'],
      name: 'sessionId',
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

  app.enable('trust proxy')

  Facebook.configureFacebookStrategy(app);
  Google.configureGoogleStrategy(app);
  GoogleToken.configureGoogleTokenStrategy(app);
  FacebookToken.configureFacebookTokenStrategy(app);
  Apple.configureAppleStrategy(app)
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
        pem.createCertificate({ days: 365, selfSigned: true }, function (
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
  server.listen(port, function () {
    console.log('Started server on port ' + port);
  });
}

module.exports = app; // for testing
