'use strict';

const mongoose = require('mongoose');
const constants = require('../constants');
const Schema = mongoose.Schema;

const RESETPASSWORD_SCHEMA_DEFINITION = {
  locale: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  skin: {
    type: String,
    trim: true
  },
  hair: {
    type: String,
    trim: true
  },
  arabic: {
    type: Boolean,
    default: false
  }
};

const resetPasswordSchema = new Schema(RESETPASSWORD_SCHEMA_DEFINITION);

const ResetPassword = mongoose.model('Language', resetPasswordSchema);

module.exports = ResetPassword;
