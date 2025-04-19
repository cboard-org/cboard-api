const passport = require('passport');
const { Strategy: FacebookStrategy } = require('passport-facebook');
const config = require('../../config');
const UserController = require('../controllers/user');

const FBStrategy = {
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL,
  profileFields: ['id', 'emails', 'name', 'displayName', 'gender', 'picture'],
  passReqToCallback: true,
  graphAPIVersion: 'v19.0'
};

passport.use(new FacebookStrategy(FBStrategy, UserController.facebookLogin));

const configureFacebookStrategy = app => {
  app.get(
    '/login/facebook',
    passport.authenticate('facebook', {
      session: false,
      scope: config.facebook.SCOPE
    })
  );

  app.get(
    '/login/facebook/callback',
    passport.authenticate('facebook', { session: false }),
    (req, res) => {
      res.json(req.user);
    }
  );
};

module.exports = {
  configureFacebookStrategy
};
