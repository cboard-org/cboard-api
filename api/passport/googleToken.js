const passport = require('passport');
const { Strategy: GoogleTokenStrategy } = require('passport-google-token');
const config = require('../../config');
const UserController = require('../controllers/user');
const url = require('url');

const GoogleTokenStrategyConfig = {
  clientID: process.env.GOOGLE_APP_ID, //config.google.APP_ID,
  clientSecret: process.env.GOOGLE_APP_SECRET, //config.google.APP_SECRET
  passReqToCallback: true
};

passport.use(
  new GoogleTokenStrategy(GoogleTokenStrategyConfig, UserController.googleLogin)
);

const configureGoogleTokenStrategy = app => {
  app.get(
    '/login/googletoken/callback',
    passport.authenticate('google-token', {
      failureRedirect: '/',
      session: false
    }),
    (req, res) => {
      res.json(req.user);
    }
  );
};

module.exports = {
  configureGoogleTokenStrategy
};
