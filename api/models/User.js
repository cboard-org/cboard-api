'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const constants = require('../constants');
const Schema = mongoose.Schema;
const Communicator = require('./Communicator');

const oAuthTypes = ['github', 'twitter', 'facebook', 'google', 'linkedin'];

const USER_SCHEMA_DEFINITION = {
  name: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  role: {
    type: String,
    default: 'user',
    required: true,
    trim: true
  },
  birthdate: {
    type: Date,
    default: Date.now
  },
  provider: {
    type: String,
    default: ''
  },
  locale: {
    type: String,
    default: constants.DEFAULT_LANG
  },
  password: {
    type: String,
    default: ''
  },
  lastlogin: {
    type: Date,
    default: Date.now
  },
  google: {
    id: String,
    token: String,
    displayName: String,
    name: String,
    lastname: String,
    gender: String,
    email: String,
    emails: [{ type: String }],
    photos: [{ type: String }]
  },
  facebook: {
    id: String,
    token: String,
    gender: String,
    displayName: String,
    name: String,
    lastname: String,
    email: String,
    emails: [{ type: String }],
    photos: [{ type: String }]
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  }
};

const USER_SCHEMA_OPTIONS = {
  toObject: {
    virtuals: true
  },
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.password;
      if (ret.authToken) {
        delete ret.authToken;
      }
    }
  }
};

const userSchema = new Schema(USER_SCHEMA_DEFINITION, USER_SCHEMA_OPTIONS);

userSchema.virtual('communicators', {
  ref: 'Communicator',
  localField: 'email',
  foreignField: 'email'
});

userSchema.virtual('boards', {
  ref: 'Board',
  localField: 'email',
  foreignField: 'email'
});

const validatePresenceOf = value => value && value.length;

/**
 * Validations
 */

// the below validations only apply if you are signing up traditionally

userSchema.path('name').validate(function(name) {
  if (this.skipValidation()) return true;
  return name.length;
}, 'Name cannot be blank');

userSchema.path('email').validate(function(email) {
  if (this.skipValidation()) return true;
  return email.length;
}, 'Email cannot be blank');

userSchema.path('email').validate(async function(email) {
  const User = mongoose.model('User');
  if (this.skipValidation()) {
    return true;
  }

  // Check only when it is a new user or when email field is modified
  if (this.isNew || this.isModified('email')) {
    const users = await User.find({ email }).exec();
    if (users.length > 0) {
      return false;
    }
  }

  return true;
}, 'Email already exists');

userSchema.path('password').validate(function(password) {
  if (this.skipValidation()) return true;

  const { facebook, google } = this;
  if (facebook.token || google.token) return true;

  return password.length;
}, 'Password cannot be blank');

/**
 * Pre-save hook
 */
userSchema.pre('save', function(next) {
  if (!this.isNew) return next();

  const { facebook, google, password } = this;
  const isValidUser =
    validatePresenceOf(password) || facebook.token || google.token;

  if (!isValidUser && !this.skipValidation()) {
    next(new Error('Invalid password'));
  } else {
    next();
  }
});

/**
 * Post-save hook
 */
userSchema.post('save', function(doc, next) {
  doc
    .populate('communicators')
    .populate('boards')
    .execPopulate()
    .then(function() {
      next();
    });
});

/**
 * Methods
 */

userSchema.methods = {
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

userSchema.statics = {
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
      .populate('communicators')
      .populate('boards')
      .exec(cb);
  },

  /**
   * Authenticate input against database
   *
   * @param {String} email
   * @param {String} password
   * @param {Function} callback
   * @api private
   */
  authenticate: function(email, password, callback) {
    this.findOne({ email: email })
      .populate('communicators')
      .populate('boards')
      .exec(function(err, user) {
        if (err) {
          return callback(err);
        } else if (!user) {
          const err = new Error('User not found.');
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
  },

  updateUser: async function(user) {
    let success = false;

    try {
      await user.save().exec();
      success = true;
    } catch (e) {}

    return success;
  },

  getById: async function(id) {
    let user = null;

    try {
      user = await this.findById(id)
        .populate('communicators')
        .populate('boards')
        .exec();
    } catch (e) {}

    return user ? user.toJSON() : null;
  },

  // Creates an user from a Facebook Profile (+ accessToken)
  // Returns a promise
  createUserFromFacebook: async function(profile) {
    const user = getUserFromProfile(profile, 'facebook', User);
    const dbUser = await user.save();
    return dbUser;
  },

  // Creates an user from a Google Profile (+ accessToken)
  // Returns a promise
  createUserFromGoogle: async function(profile) {
    const user = getUserFromProfile(profile, 'google', User);
    const dbUser = await user.save();
    return dbUser;
  },

  // Updates an user from a Facebook Profile (+ accessToken)
  // Returns a promise
  updateUserFromFacebook: async function(profile, existingUser) {
    const user = updateUserFromProfile(profile, existingUser, 'facebook');
    const dbUser = await user.save();
    return dbUser;
  },

  // Updates an user from a Google Profile (+ accessToken)
  // Returns a promise
  updateUserFromGoogle: async function(profile, existingUser) {
    const user = updateUserFromProfile(profile, existingUser, 'google');
    const dbUser = await user.save();
    return dbUser;
  }
};

function getUserType(profile) {
  const photos = profile.photos || [];

  const user = {
    id: profile.id,
    token: profile.accessToken,
    gender: profile.gender,
    displayName: profile.displayName,
    name: profile.name.givenName,
    lastname: profile.name.familyName,
    email: profile.emails[0].value,
    emails: profile.emails.map(email => email.value),
    photos: photos.map(photo => photo.value)
  };

  return user;
}

function getUserFromProfile(profile, type = 'facebook', Model = User) {
  const user = new Model();

  const userType = getUserType(profile);
  user[type] = userType;
  user.name = userType.displayName || userType.name;
  user.email = userType.email;
  return user;
}

function updateUserFromProfile(profile, existingUser, type = 'facebook') {
  const userType = getUserType(profile);
  existingUser[type] = userType;

  return existingUser;
}

const User = mongoose.model('User', userSchema);

module.exports = User;
