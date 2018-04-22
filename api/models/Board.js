'use strict';

var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var constants = require('../constants');
var Schema = mongoose.Schema;

const boardSchema = new Schema({
  name: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  user: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  content: {
    type: String,
    unique: false,
    required: true
  },
  cellSize: {
    type: String,
    trim: true,
    default: constants.DEFAULT_CELL_SIZE
  },
  locale: {
    type: String,
    default: constants.DEFAULT_LANG
  }
});

const validatePresenceOf = value => value && value.length;

/**
 * Validations
 */

// the below validations only apply if you are signing up traditionally

boardSchema.path('name').validate(function(name) {
  if (this.skipValidation()) return true;
  return name.length;
}, 'Name cannot be blank');

boardSchema.path('user').validate(function(user) {
  if (this.skipValidation()) return true;
  return user.length;
}, 'User cannot be blank');

boardSchema.path('content').validate(function(content) {
  if (this.skipValidation()) return true;
  return content.length;
}, 'Content cannot be blank');

boardSchema.path('name').validate(function(name, fn) {
  const Board = mongoose.model('Board');
  if (this.skipValidation()) fn(true);
  // Check only when it is a new board or when name field is modified
  if (this.isNew || this.isModified('name')) {
    Board.find({ name: name }).exec(function(err, boards) {
      fn(!err && boards.length === 0);
    });
  } else fn(true);
}, 'Board name already exists');

/**
 * Pre-save hook
 */

boardSchema.pre('save', function(next) {
  if (!this.isNew) return next();
  next();
});

/**
 * Methods
 */

boardSchema.methods = {
  /**
   * Validation is not required if using OAuth
   */

  skipValidation: function() {
    return ~oAuthTypes.indexOf(this.provider);
  }
};

/**
 * Statics
 */

boardSchema.statics = {
  /**
   * Load
   *
   * @param {Object} options
   * @param {Function} cb
   * @api private
   */

  load: function(options, cb) {
    options.select = options.select || 'name user';
    return this.findOne(options.criteria)
      .select(options.select)
      .exec(cb);
  },

  /**
   * Authenticate input against database
   *
   * @param {String} username
   * @param {String} password
   * @param {Function} callback
   * @api private
   */

  authenticate: function(username, password, callback) {
    this.findOne({ username: username }).exec(function(err, user) {
      if (err) {
        return callback(err);
      } else if (!user) {
        var err = new Error('User not found.');
        err.status = 401;
        return callback(err);
      }
      bcrypt.compare(password, user.password, function(err, result) {
        if (result === true) {
          return callback(null, user);
        } else {
          return callback();
        }
      });
    });
  }
};

var Board = mongoose.model('Board', boardSchema);

module.exports = Board;
