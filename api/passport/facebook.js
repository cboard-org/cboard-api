const passport = require('passport');
const { Strategy: FacebookStrategy } = require('passport-facebook');
const config = require('../../config');
const UserController = require('../controllers/user');

const FBStrategy = {
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  profileFields: ['id', 'emails', 'name', 'displayName', 'gender', 'picture']
};

passport.use(new FacebookStrategy(FBStrategy, UserController.facebookLogin));

const configureFacebookStrategy = app => {
  app.get('/login/facebook', (req, res, next) => {
    return passport.authenticate('facebook', {
      session: false,
      scope: config.facebook.SCOPE,
      callbackURL: req.domain + config.facebookCallbackPath
    })(req, res, next);
  });

  app.get(
    '/login/facebook/callback',
    (req, res, next) => {
      return passport.authenticate('facebook', {
        session: false,
        callbackURL: req.domain + config.facebookCallbackPath
      })(req, res, next);
    },
    (req, res) => {
      res.json(req.user);
    }
  );
};

module.exports = {
  configureFacebookStrategy
};
