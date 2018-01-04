var User = require('../models/User');
//var TempUser = require('../models/TempUser');
var mailing = require('../mail');

module.exports = {createUser: createUser, activateUser: activateUser};

function createUser(req, res) {
    var user = new User(req.body);

    var nev = mailing(user.locale);


    //nev.configure({
    //    tempUserModel: user
    //}, function (error, options) {
    //});

    nev.createTempUser(user, function (err, existingPersistentUser, newTempUser) {

        if (err) {
            return res.status(404).json({
                message: err
            });
        }
        // user already exists in persistent collection
        if (existingPersistentUser) {
            return res.status(409).json({
                message: 'You have already signed up and confirmed your account. Did you forget your password?'
            });
        }
        // new user created
        if (newTempUser) {

            var URL = newTempUser[nev.options.URLFieldName];
            nev.sendVerificationEmail(newTempUser.email, URL, function (err, info) {
                if (err) {
                    return res.status(500).json({
                        message: 'ERROR: sending verification email FAILED'
                    });
                }
            });

            res.status(200).json({success: 1, description: 'An email has been sent to you. Please check it to verify your account.'});


            // user already exists in temporary collection!
        } else {
            return res.status(409).json({
                message: 'You have already signed up. Please check your email to verify your account.'});
        }
    });
    console.log(user);

}
function activateUser(req, res) {
    console.log(req.params.URL);
    var url = req.params.URL;
    var nev = mailing('en');
    nev.confirmTempUser(url, function (err, user) {
        if (user) {
            nev.sendConfirmationEmail(user.email, function (err, info) {
                if (err) {
                    return res.status(404).json({
                        message: 'ERROR: sending confirmation email FAILED'});
                }
                res.status(200).json({
                    success: 1,
                    message: 'CONFIRMED!'});
            });
        } else {
            return res.status(404).json({
                message: 'ERROR: confirming temp user FAILED'});
        }
    });
}