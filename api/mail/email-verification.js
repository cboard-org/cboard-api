'use strict';

var randtoken = require('rand-token'),
  nodemailer = require('nodemailer');

module.exports = function(mongoose) {
  var isPositiveInteger = function(x) {
    return parseInt(x, 10) === x && x >= 0;
  };

  var createOptionError = function(optionName, optionValue, expectedType) {
    return new TypeError(
      'Expected ' +
        optionName +
        ' to be a ' +
        expectedType +
        ', got ' +
        typeof optionValue
    );
  };

  /**
   * Retrieve a nested value of an object given a string, using dot notation.
   *
   * @func getNestedValue
   * @param {object} obj - object to retrieve the value from
   * @param {string} path - path to value
   * @param {string} def - default value to return if not found
   */
  var getNestedValue = function(obj, path, def) {
    path = path.split('.');
    for (let i = 0, len = path.length; i < len; i++) {
      if (!obj || typeof obj !== 'object') {
        return def;
      }
      obj = obj[path[i]];
    }

    if (obj === undefined) {
      return def;
    }
    return obj;
  };
  // default options
  var options = {
    verificationURL: 'https://app.cboard.io/activate/${URL}',
    resetPasswordURL: 'https://app.cboard.io/reset/${USERID}/${URL}',
    URLLength: 48,

    // mongo-stuff
    persistentUserModel: null,
    tempUserModel: null,
    tempUserCollection: 'temporary_users',
    emailFieldName: 'email',
    passwordFieldName: 'password',
    URLFieldName: 'GENERATED_VERIFYING_URL',
    expirationTime: 86400,

    // emailing options
    transportOptions: {
      service: 'Gmail',
      auth: {
        user: 'user@gmail.com',
        pass: 'password'
      }
    },
    verifyMailOptions: {
      from: 'Do Not Reply <cboard@cboard.io>',
      subject: 'Confirm your account',
      html:
        '<p>Please verify your account by clicking <a href="${URL}">this link</a>. If you are unable to do so, copy and ' +
        'paste the following link into your browser:</p><p>${URL}</p>',
      text:
        'Please verify your account by clicking the following link, or by copying and pasting it into your browser: ${URL}'
    },
    verifySendMailCallback: function(err, info) {
      if (err) {
        throw err;
      } else {
        console.log(info.response);
      }
    },
    shouldSendConfirmation: true,
    confirmMailOptions: {
      from: 'Do Not Reply<cboard@cboard.io>',
      subject: 'Successfully verified!',
      html: '<p>Your account has been successfully verified.</p>',
      text: 'Your account has been successfully verified.'
    },
    confirmSendMailCallback: function(err, info) {
      if (err) {
        throw err;
      } else {
        console.log(info.response);
      }
    },
    resetPasswordEmailOptions: {
      from: 'Do Not Reply <user@gmail.com>',
      subject: 'Cboard - Password reset',
      html:
        '<p>A request was submitted to reset the password of your Cboard account. </p> \
        <p>This request will expire in 24 hours. Please set a new password as soon as possible.</p> \
        <p>Please reset your account by clicking<a href = "${URL}">this link</a>. </p> \
        <p>If you are unable to do so, copy and paste the following link into your browser:</p><p>${URL}</p>',
      text:
        'A request was submitted to reset the password of your Cboard account. \
        This request will expire in 24 hours. Please set a new password as soon as possible. \
        Please reset your account by clicking ${URL} \
        If you are unable to do so, copy and paste the following link into your browser: ${URL}'
    },
    hashingFunction: null,
    reportPublicBoardEmailOptions:{
      from: 'Cboard Support <cboard@cboard.io>',
      subject: 'Public Board Report',
      html:
        '<p>The user ${whistleblowerName} reported that the board ${name} from the user ${author} contains inappropiate contet. </p> \
        <p>The report reason is: ${reason}</p>\
        <p>Detailed information:</p>\
        <ul>\
          <li>Reported board info:\
            <ul>\
              <li>Board name: ${name}</li>\
              <li>Board author: ${author}</li>\
              <li>Board id: ${id}</li>\
              <li>Board description: ${description}</li>\
              <li>Board URL: ${url}</li>\
            </ul>\
          </li>\
          <li>Whistleblower Info\
            <ul>\
                <li>User name: ${whistleblowerName}</li>\
                <li>User email: ${whistleblowerEmail}</li>\
                <li>User language: ${whistleblowerLanguage}</li>\
              </ul>\
          </li>\
        </ul>',
      text:
        'The user ${whistleBlowerName} reported that the board ${name} from the user ${author} contains inappropiate contet. \
        The report reason is: ${reason}\
        Detailed information:\
        Reported board info:\
              - Board name: ${name}\
              - Board author: ${author}\
              - Board id: ${id}\
              - Board description: ${description}\
              - Board URL: ${url}\
        Whistleblower Info\
              - User name: ${whistleblowerName}\
              - User email: ${whistleblowerEmail}\
              - User language: ${whistleblowerLanguage}'
    },
    confirmSendMailReportCallback: function(err, info) {
      if (err) {
        throw err;
      } else {
        console.log(info.response);
      }
    }
  };

  var transporter;

  /**
   * Modify the default configuration.
   *
   * @func configure
   * @param {object} o - options to be changed
   */
  var configure = function(optionsToConfigure, callback) {
    for (let key in optionsToConfigure) {
      if (optionsToConfigure.hasOwnProperty(key)) {
        options[key] = optionsToConfigure[key];
      }
    }
    console.log(
      options.transportOptions.service + ' is configured as email transport.'
    );
    transporter = nodemailer.createTransport(options.transportOptions);

    // verify connection configuration
    transporter.verify(function(error, success) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email Server is ready to take our messages');
      }
    });

    var err;

    if (typeof options.verificationURL !== 'string') {
      err =
        err ||
        createOptionError('verificationURL', options.verificationURL, 'string');
    } else if (options.verificationURL.indexOf('${URL}') === -1) {
      err = err || new Error('Verification URL does not contain ${URL}');
    }

    if (typeof options.URLLength !== 'number') {
      err = err || createOptionError('URLLength', options.URLLength, 'number');
    } else if (!isPositiveInteger(options.URLLength)) {
      err = err || new Error('URLLength must be a positive integer');
    }

    if (typeof options.tempUserCollection !== 'string') {
      err =
        err ||
        createOptionError(
          'tempUserCollection',
          options.tempUserCollection,
          'string'
        );
    }

    if (typeof options.emailFieldName !== 'string') {
      err =
        err ||
        createOptionError('emailFieldName', options.emailFieldName, 'string');
    }

    if (typeof options.passwordFieldName !== 'string') {
      err =
        err ||
        createOptionError(
          'passwordFieldName',
          options.passwordFieldName,
          'string'
        );
    }

    if (typeof options.URLFieldName !== 'string') {
      err =
        err ||
        createOptionError('URLFieldName', options.URLFieldName, 'string');
    }

    if (typeof options.expirationTime !== 'number') {
      err =
        err ||
        createOptionError('expirationTime', options.expirationTime, 'number');
    } else if (!isPositiveInteger(options.expirationTime)) {
      err = err || new Error('expirationTime must be a positive integer');
    }

    if (err) {
      return callback(err, null);
    }

    return callback(null, options);
  };

  /**
   * Create a Mongoose Model for the temporary user, based off of the persistent
   * User model, i.e. the temporary user inherits the persistent user. An
   * additional field for the URL is created, as well as a TTL.
   *
   * @func generateTempUserModel
   * @param {object} User - the persistent User model.
   * @return {object} the temporary user model
   */
  var generateTempUserModel = function(User, callback) {
    if (!User) {
      return callback(new TypeError('Persistent user model undefined.'), null);
    }
    var tempUserSchemaObject = {}, // a copy of the schema
      tempUserSchema;

    // copy over the attributes of the schema
    Object.keys(User.schema.paths).forEach(function(field) {
      tempUserSchemaObject[field] = User.schema.paths[field].options;
    });
    tempUserSchemaObject[options.URLFieldName] = String;

    // create a TTL
    tempUserSchemaObject.createdAt = {
      type: Date,
      expires: options.expirationTime.toString() + 's',
      default: Date.now
    };

    tempUserSchema = mongoose.Schema(tempUserSchemaObject);

    // copy over the methods of the schema
    Object.keys(User.schema.methods).forEach(function(meth) {
      // tread lightly
      tempUserSchema.methods[meth] = User.schema.methods[meth];
    });

    options.tempUserModel = mongoose.model(
      options.tempUserCollection,
      tempUserSchema
    );

    return callback(null, mongoose.model(options.tempUserCollection));
  };

  /**
   * Helper function for actually inserting the temporary user into the database.
   *
   * @func insertTempUser
   * @param {string} password - the user's password, possibly hashed
   * @param {object} tempUserData - the temporary user's data
   * @param {function} callback - a callback function, which takes an error and the
   *   temporary user object as params
   * @return {function} returns the callback function
   */
  var insertTempUser = function(password, tempUserData, callback) {
    // password may or may not be hashed
    tempUserData[options.passwordFieldName] = password;
    var newTempUser = new options.tempUserModel(tempUserData);

    newTempUser.save(function(err, tempUser) {
      if (err) {
        return callback(err, null, null);
      }
      return callback(null, null, tempUser);
    });
  };

  /**
   * Attempt to create an instance of a temporary user based off of an instance of a
   * persistent user. If user already exists in the temporary collection, passes null
   * to the callback function; otherwise, passes the instance to the callback, with a
   * randomly generated URL associated to it.
   *
   * @func createTempUser
   * @param {object} user - an instance of the persistent User model
   * @param {function} callback - a callback function that takes an error (if one exists),
   *   a persistent user (if it exists) and the new temporary user as arguments; if the
   *   temporary user already exists, then null is returned in its place
   * @return {function} returns the callback function
   */
  var createTempUser = function(user, callback) {
    if (!options.tempUserModel) {
      return callback(
        new TypeError(
          'Temporary user model not defined. Either you forgot' +
            'to generate one or you did not predefine one.'
        ),
        null
      );
    }

    // create our mongoose query
    var query = {};

    if (options.emailFieldName.split('.').length > 1) {
      var levels = options.emailFieldName.split('.');
      query[levels[0]] = {};

      var queryObj = query[levels[0]];
      var userObj = user[levels[0]];
      for (var i = 0; i < levels.length; i++) {
        queryObj[levels[i + 1]] = {};
        queryObj = queryObj[levels[i + 1]];
        userObj = userObj[levels[i + 1]];
      }

      queryObj = userObj;
    } else {
      query[options.emailFieldName] = user[options.emailFieldName];
    }

    options.persistentUserModel.findOne(query, function(
      err,
      existingPersistentUser
    ) {
      if (err) {
        return callback(err, null, null);
      }

      // user has already signed up and confirmed their account
      if (existingPersistentUser) {
        return callback(null, existingPersistentUser, null);
      }

      options.tempUserModel.findOne(query, function(err, existingTempUser) {
        if (err) {
          return callback(err, null, null);
        }

        // user has already signed up but not yet confirmed their account
        if (existingTempUser) {
          return callback(null, null, null);
        } else {
          var tempUserData = {};

          // copy the credentials for the user
          Object.keys(user._doc).forEach(function(field) {
            tempUserData[field] = user[field];
          });

          tempUserData[options.URLFieldName] = randtoken.generate(
            options.URLLength
          );

          if (options.hashingFunction) {
            return options.hashingFunction(
              tempUserData[options.passwordFieldName],
              tempUserData,
              insertTempUser,
              callback
            );
          } else {
            return insertTempUser(
              tempUserData[options.passwordFieldName],
              tempUserData,
              callback
            );
          }
        }
      });
    });
  };

  /**
   * Send an email to the user requesting confirmation.
   *
   * @func sendVerificationEmail
   * @param {string} email - the user's email address.
   * @param {string} domain - the user's domain.
   * @param {string} url - the unique url generated for the user.
   * @param {function} callback - the callback to pass to Nodemailer's transporter
   */
  var sendVerificationEmail = function(email, domain, url, callback) {
    var r = /\$\{URL\}/g;
    var d = /\$\{DOMAIN\}/g;
    // inject newly-created URL into the email's body and FIRE
    // stringify --> parse is used to deep copy
    var URL = options.verificationURL.replace(d, domain).replace(r, url),
      mailOptions = JSON.parse(JSON.stringify(options.verifyMailOptions));

    mailOptions.to = email;
    mailOptions.html = mailOptions.html.replace(r, URL);
    mailOptions.text = mailOptions.text.replace(r, URL);
    if (!callback) {
      callback = options.verifySendMailCallback;
    }
    transporter.sendMail(mailOptions, callback);
  };

  /**
   * Send an email to the user requesting confirmation.
   *
   * @func sendConfirmationEmail
   * @param {string} email - the user's email address.
   * @param {function} callback - the callback to pass to Nodemailer's transporter
   */
  var sendConfirmationEmail = function(email, callback) {
    var mailOptions = JSON.parse(JSON.stringify(options.confirmMailOptions));
    mailOptions.to = email;
    if (!callback) {
      callback = options.confirmSendMailCallback;
    }
    transporter.sendMail(mailOptions, callback);
  };

  /**
   * Transfer a temporary user from the temporary collection to the persistent
   * user collection, removing the URL assigned to it.
   *
   * @func confirmTempUser
   * @param {string} url - the randomly generated URL assigned to a unique email
   */
  var confirmTempUser = function(url, callback) {
    var TempUser = options.tempUserModel,
      query = {};
    query[options.URLFieldName] = url;

    TempUser.findOne(query, function(err, tempUserData) {
      if (err) {
        return callback(err, null);
      }

      // temp user is found (i.e. user accessed URL before their data expired)
      if (tempUserData) {
        var userData = JSON.parse(JSON.stringify(tempUserData)), // copy data
          User = options.persistentUserModel,
          user;

        delete userData[options.URLFieldName];
        user = new User(userData);

        // save the temporary user to the persistent user collection
        user.save(function(err, savedUser) {
          if (err) {
            return callback(err, null);
          }

          TempUser.remove(query, function(err) {
            if (err) {
              return callback(err, null);
            }

            if (options.shouldSendConfirmation) {
              sendConfirmationEmail(savedUser[options.emailFieldName], null);
            }
            return callback(null, user);
          });
        });

        // temp user is not found (i.e. user accessed URL after data expired, or something else...)
      } else {
        return callback(null, null);
      }
    });
  };

  /**
   * Resend the verification email to the user given only their email.
   *
   * @func resendVerificationEmail     //NEVER IS CALLED
   * @param {object} email - the user's email address
   * @param {string} domain - dynamic domain
   */
  var resendVerificationEmail = function(email, domain, callback) {
    var query = {};
    query[options.emailFieldName] = email;
    options.tempUserModel.findOne(query, function(err, tempUser) {
      if (err) {
        return callback(err, null);
      }

      // user found (i.e. user re-requested verification email before expiration)
      if (tempUser) {
        // generate new user token
        tempUser[options.URLFieldName] = randtoken.generate(options.URLLength);
        tempUser.save(function(err) {
          if (err) {
            return callback(err, null);
          }

          sendVerificationEmail(
            getNestedValue(tempUser, options.emailFieldName),
            domain,
            tempUser[options.URLFieldName],
            function(err) {
              if (err) {
                return callback(err, null);
              }
              return callback(null, true);
            }
          );
        });
      } else {
        return callback(null, false);
      }
    });
  };

  /**
   * Send an email to the user requesting confirmation.
   *
   * @func sendResetPasswordEmail
   * @param {string} email - the user's email address.
   * @param {string} domain - dynamic domain of the user
   * @param {function} callback - the callback to pass to Nodemailer's transporter
   */
  var sendResetPasswordEmail = function(email, domain, userid, url, callback) {
    var d = /\$\{DOMAIN\}/g;
    var r = /\$\{URL\}/g;
    var u = /\$\{USERID\}/;

    // inject newly-created URL into the email's body and FIRE
    // stringify --> parse is used to deep copy
    var URL = options.resetPasswordURL.replace(d, domain).replace(r, url).replace(u, userid);
    var mailOptions = JSON.parse(
      JSON.stringify(options.resetPasswordMailOptions)
    );

    mailOptions.to = email;
    mailOptions.html = mailOptions.html.replace(r, URL);
    mailOptions.text = mailOptions.text.replace(r, URL);

    if (!callback) {
      callback = options.resetPasswordSendMailCallback;
    }
    transporter.sendMail(mailOptions, callback);
  };

    /**
   * Send an email to the Cboard support reporting a public board.
   *
   * @func sendReportEmail
   * @param {object} data - Information about the reported board, the whistleblower and the report reason.
   * @param {function} callback - the callback to pass to Nodemailer's transporter
   */
     var sendReportEmail = function(data, callback) {
      const {id,name,author,url,description,reason, whistleblower} = data;

      if(!whistleblower.name){
        whistleblower.name = 'Anonymus';
        whistleblower.email = 'Anonymus';
      }
      let mailOptions = JSON.parse(JSON.stringify(options.reportPublicBoardEmailOptions));
      mailOptions.html= mailOptions.html
                          .replace(/\$\{whistleblowerName\}/g, whistleblower.name)
                          .replace(/\$\{whistleblowerEmail\}/g, whistleblower.email)
                          .replace('${whistleblowerLanguage}', whistleblower.language)
                          .replace(/\$\{name\}/g, name)
                          .replace(/\$\{author\}/g, author)
                          .replace('${id}', id)
                          .replace('${description}', description)
                          .replace('${url}', url)
                          .replace('${reason}', reason)
      mailOptions.text= mailOptions.text
                          .replace(/\$\{whistleblowerName\}/g, whistleblower.name)
                          .replace(/\$\{whistleblowerEmail\}/g, whistleblower.email)
                          .replace('${whistleblowerLanguage}', whistleblower.language)
                          .replace(/\$\{name\}/g, name)
                          .replace(/\$\{author\}/g, author)
                          .replace('${id}', id)
                          .replace('${description}', description)
                          .replace('${url}', url)
                          .replace('${reason}', reason)

      mailOptions.to = 'support@cboard.io';
      if (!callback) {
        callback = options.confirmSendMailReportCallback;
      }
      transporter.sendMail(mailOptions, callback);
    };

  return {
    options: options,
    configure: configure,
    generateTempUserModel: generateTempUserModel,
    createTempUser: createTempUser,
    confirmTempUser: confirmTempUser,
    resendVerificationEmail: resendVerificationEmail,
    sendConfirmationEmail: sendConfirmationEmail,
    sendVerificationEmail: sendVerificationEmail,
    sendResetPasswordEmail: sendResetPasswordEmail,
    sendReportEmail: sendReportEmail
  };
};
