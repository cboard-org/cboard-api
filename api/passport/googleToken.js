const passport = require('passport');
import { Strategy as GoogleTokenStrategy } from 'passport-google-token';
const config = require('../../config');
const UserController = require('../controllers/user');

const GoogleTokenStrategyConfig = {
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET
};

passport.use(
    new GoogleTokenStrategy(GoogleTokenStrategyConfig, UserController.googleLogin)
);

const configureGoogleTokenStrategy = app => {
    app.get('/auth/google/token',
        passport.authenticate('google-token'),
        (req, res) => {
                res.send(req.user);
    });
}  

module.exports = {
    configureGoogleTokenStrategy
};