'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const constants = require('../constants');
const Schema = mongoose.Schema;

const COMMUNICATOR_SCHEMA_DEFINITION = {
  name: {
    type: String,
    unique: false,
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
};

const COMMUNICATOR_SCHEMA_OPTIONS = {
  toObject: {
    virtuals: true
  },
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
};

const communicatorSchema = new Schema(
  COMMUNICATOR_SCHEMA_DEFINITION,
  COMMUNICATOR_SCHEMA_OPTIONS
);

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

const Communicator = mongoose.model('Communicator', communicatorSchema);

module.exports = Communicator;
