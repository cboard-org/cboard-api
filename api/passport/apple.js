const passport = require('passport');
const AppleStrategy = require('passport-apple');
const config = require('../../config');
const UserController = require('../controllers/user');

const appleStrategyConfig = {
  APP_CLIENT_ID: process.env.APPLE_APP_CLIENT_ID || "mock_client_id",
  WEB_CLIENT_ID: `${process.env.APPLE_TEAM_ID}.${process.env.APPLE_APP_CLIENT_ID}`,
  TEAM_ID: process.env.APPLE_TEAM_ID,
  KEY_ID: process.env.APPLE_KEY_ID,
  SCOPE: 'email name',
  REDIRECT_URI: config.apple.CALLBACK_URL,
  PRIVATE_KEY_LOCATION: 'Apple-Sign-In-AuthKey.p8',
  USE_POP_UP: true
};

passport.use(
  'apple-app',
  new AppleStrategy(
    {
      clientID: appleStrategyConfig.APP_CLIENT_ID,
      teamID: appleStrategyConfig.TEAM_ID,
      callbackURL: appleStrategyConfig.REDIRECT_URI,
      keyID: appleStrategyConfig.KEY_ID,
      scope: appleStrategyConfig.SCOPE,
      privateKeyLocation: appleStrategyConfig.PRIVATE_KEY_LOCATION,
      passReqToCallback: true,
      usePopup: appleStrategyConfig.USE_POP_UP
    },
    UserController.appleLogin
  )
);

passport.use(
  'apple-web',
  new AppleStrategy(
    {
      clientID: appleStrategyConfig.WEB_CLIENT_ID,
      teamID: appleStrategyConfig.TEAM_ID,
      callbackURL: appleStrategyConfig.REDIRECT_URI,
      keyID: appleStrategyConfig.KEY_ID,
      scope: appleStrategyConfig.SCOPE,
      privateKeyLocation: appleStrategyConfig.PRIVATE_KEY_LOCATION,
      passReqToCallback: true,
      usePopup: appleStrategyConfig.USE_POP_UP
    },
    UserController.appleLogin
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

const configureAppleStrategy = app => {
  app.get('/login/apple-web', passport.authenticate('apple-web'));

  const passportAuthCallback = (err, user, info, req, res, next) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    // Execute the configured callback for the 'apple' strategy
    req.login(user, err => {
      if (err) {
        return next(err);
      }

      return res.json(req.user);
    });
  };

  app.post('/login/apple/callback', function(req, res, next) {
    passport.authenticate('apple-app', (err, user, info) => {
      passportAuthCallback(err, user, info, req, res, next);
    })(req, res, next);
  });

  app.post('/login/apple-web/decode', function(req, res, next) {
    const RAW_CBOARD_APP_URL = process.env.CBOARD_APP_URL;
    const RAW_CBOARD_APP_URL_LAST_CHAR = RAW_CBOARD_APP_URL.length - 1;
    const CBOARD_APP_URL =
      RAW_CBOARD_APP_URL[RAW_CBOARD_APP_URL_LAST_CHAR] === '/'
        ? RAW_CBOARD_APP_URL
        : `${RAW_CBOARD_APP_URL}/`;
    const code = req.body.code;
    res.redirect(`${CBOARD_APP_URL}login/apple-web/callback?${code}`);
  });

  app.post('/login/apple-web/callback', function(req, res, next) {
    passport.authenticate('apple-web', (err, user, info) => {
      passportAuthCallback(err, user, info, req, res, next);
    })(req, res, next);
  });
};

module.exports = {
  configureAppleStrategy
};
