var User = require('../models/User');
var mailing = require('../mail');
var nev = mailing('en');

module.exports = {createUser: createUser, activateUser: activateUser};

function createUser(req, res) {
    var user = new User(req.body);

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
                        message: 'ERROR: sending verification email FAILED ' + info
                    });
                }
            });

            res.status(200).json({
                success: 1, 
                message: 'An email has been sent to you. Please check it to verify your account.'
            });

            // user already exists in temporary collection!
        } else {
            return res.status(409).json({
                message: 'You have already signed up. Please check your email to verify your account.'
            });
        }
    });
}
function activateUser(req, res) {
    var url = req.swagger.params.url.value;
    nev.confirmTempUser(url, function (err, user) {
        if (user) {
            nev.sendConfirmationEmail(user.email, function (err, info) {
                if (err) {
                    return res.status(404).json({
                        message: 'ERROR: sending confirmation email FAILED ' + info
                    });
                }
                res.status(200).json({
                    success: 1,
                    message: 'CONFIRMED!'
                });
            });
        } else {
            return res.status(404).json({
                message: 'ERROR: confirming temp user FAILED ' + err
            });
        }
    });
}
