const passport = require('passport');
const { OAuth2Strategy: GoogleStrategy } = require('passport-google-oauth');
const config = require('../../config');
const UserController = require('../controllers/user');

const urljoin = require('url-join');

const GooglePhotosStrategyConfig = {
  clientID: config.google.APP_ID,
  clientSecret: config.google.APP_SECRET
};

passport.use(
  'googlePhotosLogin',
  new GoogleStrategy(GooglePhotosStrategyConfig, function(
    accessToken,
    refreshToken,
    profile,
    done
  ) {
    console.log('response');
    const response = {
      access_token: accessToken
    };
    return done(null, response);
  })
);

const configureGooglePhotosStrategy = app => {
  app.get('/auth/google-photos', (req, res, next) =>
    passport.authenticate('googlePhotosLogin', {
      session: false,
      scope: config.google.GOOGLE_PHOTOS_SCOPE,
      callbackURL: urljoin(req.domain, config.googlePhotosCallbackPath)
    })(req, res, next)
  );

  app.get(
    '/auth/google-photos/callback',
    (req, res, next) =>
      passport.authenticate('googlePhotosLogin', {
        callbackURL: urljoin(req.domain, config.googlePhotosCallbackPath),
        failureRedirect: '/',
        session: false
      })(req, res, next),
    (req, res) => {
      res.json(req.user);
    }
  );
};

module.exports = {
  configureGooglePhotosStrategy
};
