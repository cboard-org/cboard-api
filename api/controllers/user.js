const moment = require('moment');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const { paginatedResponse } = require('../helpers/response');
const { getORQuery } = require('../helpers/query');
const User = require('../models/User');
const ResetPassword = require('../models/ResetPassword');
const Settings = require('../models/Settings');
const mailing = require('../mail');
const nev = mailing('en');
const auth = require('../helpers/auth');

module.exports = {
  createUser: createUser,
  activateUser: activateUser,
  listUser: listUser,
  removeUser: removeUser,
  getUser: getUser,
  updateUser: updateUser,
  loginUser: loginUser,
  logoutUser: logoutUser,
  getMe: getMe,
  facebookLogin: facebookLogin,
  googleLogin: googleLogin,
  forgotPassword: forgotPassword,
  storePassword: storePassword
};

const USER_MODEL_ID_TYPE = {
  facebook: 'facebook.id',
  google: 'google.id'
};

async function getSettings(user) {
  let settings = null;

  try {
    settings = await Settings.getOrCreate({ id: user.id || user._id });
    delete settings.user;
  } catch (e) {}

  return settings;
}

function createUser(req, res) {
  const user = new User(req.body);
  nev.createTempUser(user, function(err, existingPersistentUser, newTempUser) {
    if (err) {
      return res.status(404).json({
        message: err
      });
    }
    // user already exists in persistent collection
    if (existingPersistentUser) {
      return res.status(409).json({
        message:
          'You have already signed up and confirmed your account. Did you forget your password?'
      });
    }
    // new user created
    if (newTempUser) {
      const URL = newTempUser[nev.options.URLFieldName];
      
      let domain = req.headers.origin;
      //if origin is private insert default hostname
      if (!domain){ 
        domain = 'https://app.cboard.io'
      }

      nev.sendVerificationEmail(newTempUser.email, domain, URL, function(err, info) {
        if (err) {
          return res.status(500).json({
            message: 'ERROR: sending verification email FAILED ' + info
          });
        }
      });

      return res.status(200).json({
        success: 1,
        url: URL,
        message:
          'An email has been sent to you. Please check it to verify your account.'
      });

      // user already exists in temporary collection!
    } else {
      return res.status(409).json({
        message:
          'You have already signed up. Please check your email to verify your account.'
      });
    }
  });
}

// Login from Facebook or Google
async function passportLogin(type, accessToken, refreshToken, profile, done) {
  try {
    const propertyId = USER_MODEL_ID_TYPE[type];
    let user = await User.findOne({ [propertyId]: profile.id })
      .populate('communicators')
      .populate('boards')
      .exec();

    if (!user) {
      user = await createOrUpdateUser(accessToken, profile, type);
    }

    const { _id: userId, email } = user;
    const tokenString = auth.issueToken({
      id: userId,
      email
    });

    const settings = await getSettings(user);

    const response = {
      ...user.toJSON(),
      settings,
      authToken: tokenString
    };

    done(null, response);
  } catch (err) {
    console.error('Passport Login error', err);
    return done(err);
  }
}

async function facebookLogin(accessToken, refreshToken, profile, done) {
  return passportLogin('facebook', accessToken, refreshToken, profile, done);
}

async function googleLogin(accessToken, refreshToken, profile, done) {
  return passportLogin('google', accessToken, refreshToken, profile, done);
}

async function createOrUpdateUser(accessToken, profile, type = 'facebook') {
  const fnMap = {
    facebook: {
      create: 'createUserFromFacebook',
      update: 'updateUserFromFacebook'
    },
    google: {
      create: 'createUserFromGoogle',
      update: 'updateUserFromGoogle'
    }
  };

  const mergedProfile = { ...profile, accessToken };
  const emails = profile.emails.map(email => email.value);
  const existingUser = await User.findOne({ email: { $in: emails } }).exec();

  const userModelFn = existingUser ? fnMap[type].update : fnMap[type].create;
  const user = await User[userModelFn](mergedProfile, existingUser);

  return user;
}

function activateUser(req, res) {
  const url = req.swagger.params.url.value;
  nev.confirmTempUser(url, function(err, user) {
    if (user) {
      nev.sendConfirmationEmail(user.email, function(err, info) {
        if (err) {
          return res.status(404).json({
            message: 'ERROR: sending confirmation email FAILED ' + info
          });
        }
        return res.status(200).json({
          success: 1,
          userid: user._id,
          message: 'CONFIRMED!'
        });
      });
    } else {
      return res.status(404).json({
        message: 'ERROR: confirming your temporary user FAILED, please try to login again',
        error:  'ERROR: confirming your temporary user FAILED, please try to login again'
      });
    }
  });
}

async function listUser(req, res) {
  const { search = '' } = req.query;
  const searchFields = ['name', 'author', 'email'];
  const query =
    search && search.length ? getORQuery(searchFields, search, true) : {};

  const response = await paginatedResponse(
    User,
    {
      query,
      populate: ['communicators', 'boards']
    },
    req.query
  );

  return res.status(200).json(response);
}

function removeUser(req, res) {
  const id = req.swagger.params.id.value;
  User.findByIdAndRemove(id, function(err, users) {
    if (err) {
      return res.status(404).json({
        message: 'User not found. User Id: ' + id
      });
    }
    return res.status(200).json(users);
  });
}

async function getUser(req, res) {
  const id = req.swagger.params.id.value;

  try {
    const user = await User.findById(id)
      .populate('communicators')
      .populate('boards')
      .exec();

    if (!user) {
      return res.status(404).json({
        message: `User does not exist. User Id: ${id}`
      });
    }

    const settings = await getSettings(user);
    const response = {
      ...user.toJSON(),
      settings
    };

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({
      message: 'Error getting user.',
      error: err.message
    });
  }
}

const UPDATEABLE_FIELDS = [
  'email',
  'name',
  'birthdate',
  'locale',
]

function updateUser(req, res) {
  const id = req.swagger.params.id.value;

  if (!req.user.isAdmin && req.auth.id !== id) {
    return res.status(403).json({
      message: 'You are not authorized to update this user.'
    })
  }

  User.findById(id)
    .populate('communicators')
    .populate('boards')
    .exec(function(err, user) {
      if (err) {
        return res.status(500).json({
          message: 'Error updating user. ',
          error: err.message
        });
      }
      if (!user) {
        return res.status(404).json({
          message: 'Unable to find user. User Id: ' + id
        });
      }
      for (let key in req.body) {
        if (UPDATEABLE_FIELDS.includes(key)) {
          user[key] = req.body[key];
        }
      }
      user.save(function(err, user) {
        if (err) {
          return res.status(500).json({
            message: 'Error saving user. ',
            error: err.message
          });
        }
        if (!user) {
          return res.status(404).json({
            message: 'Unable to find user. User id: ' + id
          });
        }
      });
      return res.status(200).json(user);
    });
}

function loginUser(req, res) {
  const { email, password } = req.body;

  User.authenticate(email, password, async (error, user) => {
    if (error || !user) {
      return res.status(401).json({
        message: 'Wrong email or password.'
      });
    } else {
      const userId = user._id;
      req.session.userId = userId;

      const tokenString = auth.issueToken({
        email,
        id: userId
      });

      const settings = await getSettings(user);

      const response = {
        ...user.toJSON(),
        settings,
        birthdate: moment(user.birthdate).format('YYYY-MM-DD'),
        authToken: tokenString
      };

      return res.status(200).json(response);
    }
  });
}

function logoutUser(req, res) {
  if (req.session) {
    // delete session object
    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({
          message: 'Error removing session .',
          error: err.message
        });
      }
    });
  }

  return res.status(200).json({
    message: 'User successfully logout'
  });
}

async function getMe(req, res) {
  if (!req.user) {
    return res
      .status(400)
      .json({ message: 'Are you logged in? Is bearer token present?' });
  }

  const settings = await getSettings(req.user);
  const response = { ...req.user, settings };

  return res.status(200).json(response);
}

async function forgotPassword(req, res) {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: { $in: email } }).exec();
    if (!user) {
      return res.status(404).json({
        message: 'No user found with that email address. Check your input.'
      });
    }
    const resetPassword = await ResetPassword.findOne({
      userId: user.id,
      status: false
    }).exec();
    if (resetPassword) {
      //remove entry if exist
      await ResetPassword.deleteOne({ _id: resetPassword.id }, function(err) {
        if (err) {
          return res.status(500).json({
            message: 'ERROR: delete reset password FAILED ',
            error: err.message
          });
        }
      }).exec();
    }
    //creating the token to be sent to the forgot password form
    token = crypto.randomBytes(32).toString('hex');
    //hashing the password to store in the db node.js
    bcrypt.genSalt(8, function(err, salt) {
      bcrypt.hash(token, salt, function(err, hash) {
        const item = new ResetPassword({
          userId: user.id,
          resetPasswordToken: hash,
          resetPasswordExpires: moment.utc().add(86400, 'seconds'),
          status: false
        });
        item.save(function(err, rstPassword) {
          if (err) {
            return res.status(500).json({
              message: 'ERROR: create reset password FAILED ',
              error: err.message
            });
          }
        });
        //sending mail to the user where he can reset password.
        //User id, the token generated and user domain are sent as params in a link

        let domain = req.headers.origin;
        //if origin is private insert default hostname
        if (!domain){ 
          domain = 'https://app.cboard.io'
        }

        nev.sendResetPasswordEmail(user.email, domain, user.id, token, function(err) {
          if (err) {
            return res.status(500).json({
              message: 'ERROR: sending reset your password email FAILED ',
              error: err.message
            });
          } else {
            const response = {
              success: 1,
              userid: user.id,
              url: token,
              message: 'Success! Check your mail to reset your password.'
            };
            return res.status(200).json(response);
          }
        });
      });
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error resetting user password.',
      error: err.message
    });
  }
}
async function storePassword(req, res) {
  const { userid, password, token } = req.body;

  try {
    const resetPassword = await ResetPassword.findOne({
      userId: userid,
      status: false
    }).exec();
    if (!resetPassword) {
      return res.status(500).json({
        message: 'Expired time to reset password! ',
        error: err.message
      });
    }
    // the token and the hashed token in the db are verified befor updating the password
    bcrypt.compare(token, resetPassword.token, function(errBcrypt, resBcrypt) {
      let expireTime = moment.utc(resetPassword.expire);
      let currentTime = new Date();
      //hashing the password to store in the db node.js
      bcrypt.genSalt(8, function(err, salt) {
        bcrypt.hash(password, salt, async function(err, hash) {
          const user = await User.findOneAndUpdate(
            { _id: userid },
            { password: hash }
          );
          if (!user) {
            return res.status(404).json({
              message: 'No user found with that ID.'
            });
          }
          ResetPassword.findOneAndUpdate(
            { id: resetPassword.id },
            { status: true },
            function(err) {
              if (err) {
                return res.status(500).json({
                  message: 'ERROR: reset your password email FAILED ',
                  error: err.message
                });
              } else {
                const response = {
                  success: 1,
                  url: token,
                  message: 'Success! We have reset your password.'
                };
                return res.status(200).json(response);
              }
            }
          );
        });
      });
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error resetting user password.',
      error: err.message
    });
  }
}
