const { paginatedResponse } = require('../helpers/response');
const { getORQuery } = require('../helpers/query');
const User = require('../models/User');
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
  getMe: getMe
};

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
      nev.sendVerificationEmail(newTempUser.email, URL, function(err, info) {
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
        message: 'ERROR: confirming temp user FAILED ',
        error: err
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

function getUser(req, res) {
  const id = req.swagger.params.id.value;
  User.findById(id)
    .populate('communicators')
    .populate('boards')
    .exec(function(err, users) {
      if (err) {
        return res.status(500).json({
          message: 'Error getting user. ',
          error: err
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
  const id = req.swagger.params.id.value;
  User.findById(id)
    .populate('communicators')
    .populate('boards')
    .exec(function(err, user) {
      if (err) {
        return res.status(500).json({
          message: 'Error updating user. ',
          error: err
        });
      }
      if (!user) {
        return res.status(404).json({
          message: 'Unable to find user. User Id: ' + id
        });
      }
      for (let key in req.body) {
        user[key] = req.body[key];
      }
      user.save(function(err, user) {
        if (err) {
          return res.status(500).json({
            message: 'Error saving user. ',
            error: err
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

  User.authenticate(email, password, (error, user) => {
    if (error || !user) {
      return res.status(401).json({
        message: 'Wrong email or password.'
      });
    } else {
      const userId = user._id;
      req.session.userId = userId;

      const tokenString = auth.issueToken({
        id: userId,
        email
      });

      const response = { ...user.toJSON(), authToken: tokenString };
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
          error: err
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

  return res.status(200).json(req.user);
}
