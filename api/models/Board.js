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
  email: {
    type: String,
    unique: false,
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

boardSchema.path('email').validate(function(email) {
  if (this.skipValidation()) return true;
  return email.length;
}, 'User email cannot be blank');

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

boardSchema.path('email').validate(function(email, fn) {
  const User = mongoose.model('User');
  if (this.skipValidation()) fn(true);
  // Check only when it is a new user or when email field is modified
  if (this.isNew || this.isModified('email')) {
    User.find({ email: email }).exec(function(err, users) {
      fn(!err && users.length > 0);
    });
  } else fn(true);
}, 'User Email does not exist in database');

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
    return null;
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
    options.select = options.select || 'name email';
    return this.findOne(options.criteria)
      .select(options.select)
      .exec(cb);
  }
};

var Board = mongoose.model('Board', boardSchema);

module.exports = Board;
