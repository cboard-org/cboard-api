'use strict';

const mongoose = require('mongoose');
const constants = require('../constants');
const Schema = mongoose.Schema;

const BOARD_SCHEMA_DEFINITION = {
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
  isPublic: {
    type: Boolean,
    default: false
  },
  tiles: {
    type: Array,
    unique: false
  },
  cellSize: {
    type: String,
    trim: true,
    default: constants.DEFAULT_CELL_SIZE
  },
  locale: {
    type: String,
    default: constants.DEFAULT_LANG
  },
  caption: {
    type: String,
    unique: false,
    trim: true
  },
  format: {
    type: String,
    default: constants.DEFAULT_FORMAT
  },
  lastEdited: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    unique: false,
    default: ''
  }
};

const BOARD_SCHEMA_OPTIONS = {
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

const boardSchema = new Schema(BOARD_SCHEMA_DEFINITION, BOARD_SCHEMA_OPTIONS);

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

boardSchema.path('email').validate(async function(email) {
  const User = mongoose.model('User');
  if (this.skipValidation()) {
    return true;
  }

  // Check only when it is a new user or when email field is modified
  if (this.isNew || this.isModified('email')) {
    const users = await User.find({ email }).exec();
    if (users.length < 1) {
      return false;
    }
  }

  return true;
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

const Board = mongoose.model('Board', boardSchema);

module.exports = Board;
