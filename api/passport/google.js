const passport = require('passport');
const { OAuth2Strategy: GoogleStrategy } = require('passport-google-oauth');
const config = require('../../config');
const UserController = require('../controllers/user');

const urljoin = require('url-join');

const GoogleStrategyConfig = {
  clientID: config.google.APP_ID,
  clientSecret: config.google.APP_SECRET
};

passport.use(
  new GoogleStrategy(GoogleStrategyConfig, UserController.googleLogin)
);

const configureGoogleStrategy = app => {
  app.get('/login/google', (req, res, next) => 
    passport.authenticate('google', {
      session: false,
      scope: config.google.SCOPE,
      callbackURL: urljoin(req.domain, config.googleCallbackPath)
    })(req, res, next)
  );

  // GET /login/google/callback
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  If authentication fails, the user will be redirected back to the
  //   login page.  Otherwise, the primary route function function will be called,
  //   which, in this example, will redirect the user to the home page.
  app.get(
    '/login/google/callback',
    (req, res, next) => 
      passport.authenticate('google', {
        callbackURL: urljoin(req.domain, config.googleCallbackPath),
        failureRedirect: '/',
        session: false
      })(req, res, next)
    ,
    (req, res) => {
      res.json(req.user);
    }
  );
};

module.exports = {
  configureGoogleStrategy
};
