'use strict';

const mongoose = require('mongoose');
const constants = require('../constants');
const Schema = mongoose.Schema;

const RESETPASSWORD_SCHEMA_DEFINITION = {
  userId: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  status: {
    type: Boolean,
    default: 0
  }
};

const resetPasswordSchema = new Schema(RESETPASSWORD_SCHEMA_DEFINITION);

const ResetPassword = mongoose.model('ResetPassword', resetPasswordSchema);

module.exports = ResetPassword;
