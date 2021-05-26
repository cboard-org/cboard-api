const passport = require('passport');
const { OAuth2Strategy: GoogleStrategy } = require('passport-google-oauth');
const config = require('../../config');
const UserController = require('../controllers/user');

const GoogleStrategyConfig = {
  clientID: config.google.APP_ID,
  clientSecret: config.google.APP_SECRET,
  callbackURL: config.google.CALLBACK_URL
};

passport.use(
  new GoogleStrategy(GoogleStrategyConfig, UserController.googleLogin)
);

const configureGoogleStrategy = app => {
  app.get(
    '/login/google',
    passport.authenticate('google', {
      session: false,
      scope: config.google.SCOPE
    })
  );

  // GET /login/google/callback
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  If authentication fails, the user will be redirected back to the
  //   login page.  Otherwise, the primary route function function will be called,
  //   which, in this example, will redirect the user to the home page.
  app.get(
    '/login/google/callback',
    passport.authenticate('google', { failureRedirect: '/', session: false }),
    (req, res) => {
      res.json(req.user);
    }
  );
  passport.use(new GoogleTokenStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET
  },
    function (accessToken, refreshToken, profile, done) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return done(err, user);
      });
    }
    ));
    app.get('/auth/google/token', passport.authenticate('google-token'),
      function (req, res) {
        res.send(req.user);
      });
};

module.exports = {
  configureGoogleStrategy
};
