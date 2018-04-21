'use strict';

var User = require('../models/User');
var config = require('../../config');
var mongoose = require('mongoose');
var nev = require('email-verification')(mongoose);
var bcrypt = require('bcryptjs');

module.exports = function(locale) {
  var myHasher = function(password, tempUserData, insertTempUser, callback) {
    bcrypt.genSalt(8, function(err, salt) {
      bcrypt.hash(password, salt, function(err, hash) {
        return insertTempUser(hash, tempUserData, callback);
      });
    });
  };

  var subject, html, text;
  switch (locale) {
    case 'en':
      subject = 'Cboard - Please confirm account';
      (html =
        'Thanks for signup to Cboard!<br>Click the following link to confirm your account:</p><p>${URL}</p><br>Thanks,<br>The Cboard team'),
        (text =
          'Thanks for signup to Cboard!. Please confirm your account by clicking the following link: ${URL}');
      break;
    case 'es':
      (subject = 'Por favor, confirma tu cuenta'),
        (html =
          'Pulsa el enlace siguiente para confirmar tu cuenta:</p><p>${URL}</p>'),
        (text =
          'Por favor, confirma tu cuenta pulsando el enlace siguiente: ${URL}');
      break;
    default:
      subject = 'Cboard - Please confirm account';
      (html =
        'Thanks for signup to Cboard!<br>Click the following link to confirm your account:</p><p>${URL}</p><br>Thanks,<br>The Cboard team'),
        (text =
          'Thanks for signup to Cboard!. Please confirm your account by clicking the following link: ${URL}');
  }

  nev.configure(
    {
      verificationURL: 'https://app.cboard.io/activate/${URL}',
      URLLength: 16,

      // mongo-stuff
      persistentUserModel: User,
      emailFieldName: 'email',
      passwordFieldName: 'password',
      URLFieldName: 'GENERATED_VERIFYING_URL',
      expirationTime: 86400, //1 day

      // emailing options
      transportOptions: config.emailTransport,
      verifyMailOptions: {
        from: 'Do Not Reply <cboard@cboard.io>',
        subject: subject,
        html: html,
        text: text
      },
      shouldSendConfirmation: true,
      confirmMailOptions: {
        from: 'Do Not Reply <cboard@cboard.io>',
        subject: 'Cboard - Successfully verified!',
        html: '<p>Your account at Cboard has been successfully verified.</p>',
        text: 'Your account at Cboard has been successfully verified.'
      },
      hashingFunction: myHasher
    },
    function(err, options) {
      if (err) {
        console.log(err);
        return;
      }
      console.log('configured: ' + (typeof options === 'object'));
    }
  );

  nev.generateTempUserModel(User, function(err, tempUserModel) {
    if (err) {
      console.log(err);
      return;
    }
    console.log(
      'generated temp user model: ' + (typeof tempUserModel === 'function')
    );
  });

  return nev;
};
