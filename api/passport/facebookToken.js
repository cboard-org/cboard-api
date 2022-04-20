const passport = require('passport');
const FacebookTokenStrategy = require('passport-facebook-token');
const config = require('../../config');
const UserController = require('../controllers/user');

const FBStrategy = {
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    fbGraphVersion: 'v3.0'
  };

passport.use(new FacebookTokenStrategy(FBStrategy, UserController.facebookLogin));

const configureFacebookTokenStrategy = app => {
    if(FBStrategy.clientSecret === null){
      console.warn("FBStrategy is not configured. Configuration values missing");
      return;
    }
    app.get(
      '/login/facebooktoken/callback',
      passport.authenticate('facebook-token', {
        failureRedirect: '/',
        session: false
      }),
      (req, res) => {
        res.json(req.user);
        console.log(req.user);
      }
    );
};
  
module.exports = {
    configureFacebookTokenStrategy
};