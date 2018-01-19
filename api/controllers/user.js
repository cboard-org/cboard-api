var User = require('../models/User');
var mailing = require('../mail');
var nev = mailing('en');
var auth = require("../helpers/auth");

module.exports = {
    createUser: createUser,
    activateUser: activateUser,
    listUser: listUser,
    removeUser: removeUser,
    getUser: getUser,
    updateUser: updateUser,
    loginUser: loginUser,
    logoutUser: logoutUser
};

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

            return res.status(200).json({
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
                return res.status(200).json({
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
function listUser(req, res) {
    User.find(function (err, Users) {
        if (err) {
            return res.status(500).json({
                message: 'Error getting user list. ' + err
            });
        }
        return res.status(200).json(Users);
    });
}
function removeUser(req, res) {
    var id = req.swagger.params.id.value;
    User.findByIdAndRemove(id, function (err, users) {
        if (err) {
            return res.status(404).json({
                message: 'User not found. User Id: ' + id
            });
        }
        return res.status(200).json(users);
    });
}
function getUser(req, res) {
    var id = req.swagger.params.id.value;
    User.findOne({_id: id}, function (err, users) {
        if (err) {
            return res.status(500).json({
                message: 'Error getting user. ' + err
            });
        }
        if (!users) {
            return res.status(404).json({
                message: 'User does not exist. User Id: ' + id
            });
        }
        return res.status(200).json(users);
    });
}
function updateUser(req, res) {
    var id = req.swagger.params.id.value;
    User.findOne({_id: id}, function (err, users) {
        if (err) {
            return res.status(500).json({
                message: 'Error updating user. ' + err
            });
        }
        if (!users) {
            return res.status(404).json({
                message: 'Unable to find user. User Id: ' + id
            });
        }
        users.name = req.body.name;
        users.username = req.body.username;
        users.email = req.body.email;
        users.locale = req.body.locale;
        users.save(function (err, users) {
            if (err) {
                return res.status(500).json({
                    message: 'Error saving user ' + err
                });
            }
            if (!users) {
                return res.status(404).json({
                    message: 'Unable to find user. User id: ' + id
                });
            }
        });
        return res.status(200).json(users);
    });
}
function loginUser(req, res) {
    var role = req.swagger.params.role.value;
    var username = req.body.username;
    var password = req.body.password;

    if (role !== "user" && role !== "admin") {
        return res.status(400).json({
            message: "Error: Role must be either admin or user"
        });
    }
    User.authenticate(username, password, function (error, user) {
      if (error || !user) {
          return res.status(401).json({
             message: "Wrong email or password."
         });
      } else {
        req.session.userId = user._id;
        var tokenString = auth.issueToken(username, role);
        user.authToken = tokenString;
        user.save(function (err, user) {
            if (err) {
                return res.status(500).json({
                    message: 'Error saving user ' + err
                });
            }
            if (!user) {
                return res.status(404).json({
                    message: 'Unable to find user. User id: ' + user._id
                });
            }
        });
        return res.status(200).json({
            token: tokenString,
            message: "Token successfully generated"
        });
      }
    });
}
function logoutUser(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    User.authenticate(username, password, function (error, user) {
        if (error || !user) {
            return res.status(401).json({
                message: "Wrong email or password."
            });
        }
        if (req.session) {
            // delete session object
            req.session.destroy(function (err) {
                if (err) {
                    return res.status(500).json({
                        message: 'Error removing session ' + err
                    });
                }
            });
        }
        user.authToken = '';
        user.save(function (err, user) {
            if (err) {
                return res.status(500).json({
                    message: 'Error saving user ' + err
                });
            }
            if (!user) {
                return res.status(404).json({
                    message: 'Unable to find user. User id: ' + user._id
                });
            }
        });
        return res.status(200).json({
            message: "User successfully logout"
        });
    });
}
