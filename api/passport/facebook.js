const passport = require('passport');
const { Strategy: FacebookStrategy } = require('passport-facebook');
const config = require('../../config');
const UserController = require('../controllers/user');

const FBStrategy = {
  clientID: config.facebook.APP_ID,
  clientSecret: config.facebook.APP_SECRET,
  callbackURL: config.facebook.CALLBACK_URL,
  profileFields: config.facebook.PROFILE_FIELDS
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
