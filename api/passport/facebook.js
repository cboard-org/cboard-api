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
  let domain;
  app.get('/login/facebook', (req, res, next) => {
    domain = req.headers.referer;
    //if referer is private insert default hostname
    if (!domain) {
      domain = 'https://app.cboard.io/';
    }
    return passport.authenticate('facebook', {
      session: false,
      scope: config.facebook.SCOPE,
      callbackURL: domain + config.facebookCallbackPath
    })(req, res, next);
  });

  app.get(
    '/login/facebook/callback',
    (req, res, next) => {
      return passport.authenticate('facebook', {
        session: false,
        callbackURL: domain + config.facebookCallbackPath
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
