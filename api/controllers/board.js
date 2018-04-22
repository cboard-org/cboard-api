var User = require('../models/Board');
var mailing = require('../mail');
var nev = mailing('en');
var auth = require('../helpers/auth');

module.exports = {
  createBoard: createBoard,
  listBoard: listBoard,
  removeBoard: removeBoard,
  getBoard: getBoard,
  updateBoard: updateBoard
};

function createBoard(req, res) {
  var user = new User(req.body);

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
      var URL = newTempUser[nev.options.URLFieldName];
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
function listBoard(req, res) {
  User.find(function(err, Users) {
    if (err) {
      return res.status(500).json({
        message: 'Error getting user list. ' + err
      });
    }
    return res.status(200).json(Users);
  });
}
function removeBoard(req, res) {
  var id = req.swagger.params.id.value;
  User.findByIdAndRemove(id, function(err, users) {
    if (err) {
      return res.status(404).json({
        message: 'User not found. User Id: ' + id
      });
    }
    return res.status(200).json(users);
  });
}
function getBoard(req, res) {
  var id = req.swagger.params.id.value;
  User.findOne({ _id: id }, function(err, users) {
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
function updateBoard(req, res) {
  var id = req.swagger.params.id.value;
  User.findOne({ _id: id }, function(err, user) {
    if (err) {
      return res.status(500).json({
        message: 'Error updating user. ' + err
      });
    }
    if (!user) {
      return res.status(404).json({
        message: 'Unable to find user. User Id: ' + id
      });
    }
    for (var key in req.body) {
      user[key] = req.body[key];
    }
    user.save(function(err, user) {
      if (err) {
        return res.status(500).json({
          message: 'Error saving user ' + err
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
