'use strict';

var mongoose = require('mongoose');
var bcrypt = require('bcrypt');


var Schema = mongoose.Schema;

const oAuthTypes = [
    'github',
    'twitter',
    'facebook',
    'google',
    'linkedin'
];

const userSchema = new Schema({
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
    username: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        default: ''
    },
    provider: {
        type: String, 
        default: ''
        },
    locale: {
        type: String, 
        default: 'en'
        },
    password: {
        type: String,
        required: true,
        default: ''
        },
    authToken: {
        type: String,
        default: ''
        },
    lastlogin: {
        type: Date, 
        default: Date.now
        },
    facebook: {
        id: String,
        token: String,
        email: String,
        name: String
    },
    google: {
        id: String,
        token: String,
        email: String,
        name: String
    }
});

const validatePresenceOf = value => value && value.length;

/**
 * Validations
 */

// the below 5 validations only apply if you are signing up traditionally

userSchema.path('name').validate(function (name) {
    if (this.skipValidation())
        return true;
    return name.length;
}, 'Name cannot be blank');

userSchema.path('email').validate(function (email) {
    if (this.skipValidation())
        return true;
    return email.length;
}, 'Email cannot be blank');

userSchema.path('email').validate(function (email, fn) {
    const User = mongoose.model('User');
    if (this.skipValidation())
        fn(true);

    // Check only when it is a new user or when email field is modified
    if (this.isNew || this.isModified('email')) {
        User.find({email: email}).exec(function (err, users) {
            fn(!err && users.length === 0);
        });
    } else
        fn(true);
}, 'Email already exists');

userSchema.path('username').validate(function (username) {
    if (this.skipValidation())
        return true;
    return username.length;
}, 'Username cannot be blank');

userSchema.path('password').validate(function (password) {
    if (this.skipValidation())
        return true;
    return password.length;
}, 'Password cannot be blank');


/**
 * Pre-save hook
 */

userSchema.pre('save', function (next) {
    if (!this.isNew)
        return next();

    if (!validatePresenceOf(this.password) && !this.skipValidation()) {
        next(new Error('Invalid password'));
    } else {
        next();
    }
});

/**
 * Methods
 */

userSchema.methods = {

    /**
     * Validation is not required if using OAuth
     */

    skipValidation: function () {
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

    load: function (options, cb) {
        options.select = options.select || 'name username';
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
    
    authenticate: function (username, password, callback) {
        this.findOne({ username: username })
            .exec(function (err, user) {
                if (err) {
                    return callback(err);
                } else if (!user) {
                    var err = new Error('User not found.');
                    err.status = 401;
                    return callback(err);
                }
                bcrypt.compare(password, user.password, function (err, result) {
                    if (result === true) {
                        return callback(null, user);
                    } else {
                        return callback();
                    }
                });
            });
        }
    };

var User = mongoose.model('User', userSchema);

module.exports = User;
