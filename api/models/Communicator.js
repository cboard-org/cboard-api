'use strict';

var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var constants = require('../constants');
var Schema = mongoose.Schema;

const communicatorSchema = new Schema({
  name: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  author: {
    type: String,
    unique: false,
    required: true,
    trim: true
  },
  email: {
    type: String,
    unique: false,
    required: true,
    trim: true
  },
  description: {
    type: String,
    unique: false,
    required: false,
    trim: true
  },
  rootBoard: {
    type: String,
    unique: false,
    required: true,
    trim: true
  },
  boards: [{ type: String }]
});

const validatePresenceOf = value => value && value.length;

/**
 * Validations
 */

// the below validations only apply if you are signing up traditionally

communicatorSchema.path('name').validate(function(name) {
  if (this.skipValidation()) return true;
  return name.length;
}, 'Name cannot be blank');

communicatorSchema.path('author').validate(function(author) {
  if (this.skipValidation()) return true;
  return author.length;
}, 'Author cannot be blank');

communicatorSchema.path('email').validate(function(email) {
  if (this.skipValidation()) return true;
  return email.length;
}, "Author's email cannot be blank");

communicatorSchema.path('boards').validate(function(boards) {
  if (this.skipValidation()) return true;
  return boards.length;
}, 'Boards length should be greater than 0');

communicatorSchema.path('rootBoard').validate(function(rootBoard) {
  if (this.skipValidation()) return true;
  return rootBoard.length;
}, 'RootBoard cannot be blank');

communicatorSchema.path('rootBoard').validate(function(rootBoard, fn) {
  if (this.skipValidation()) fn(true);
  fn(this.boards.indexOf(rootBoard) >= 0);
}, 'Communicator rootBoard should be exists in boards field');

communicatorSchema.path('name').validate(function(name, fn) {
  const Communicator = mongoose.model('Communicator');
  if (this.skipValidation()) fn(true);
  // Check only when it is a new Communicator or when name field is modified
  if (this.isNew || this.isModified('name')) {
    Communicator.find({ name: name }).exec(function(err, communicators) {
      fn(!err && communicators.length === 0);
    });
  } else fn(true);
}, 'Communicator name already exists');

communicatorSchema.path('email').validate(function(email, fn) {
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

communicatorSchema.pre('save', function(next) {
  if (!this.isNew) return next();
  next();
});

/**
 * Methods
 */

communicatorSchema.methods = {
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
communicatorSchema.statics = {};

var Communicator = mongoose.model('Communicator', communicatorSchema);

module.exports = Communicator;
