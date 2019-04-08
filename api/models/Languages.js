'use strict';

const mongoose = require('mongoose');
const constants = require('../constants');
const Schema = mongoose.Schema;

const LANGUAGES_SCHEMA_DEFINITION = {
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
  }
};

const languagesSchema = new Schema(LANGUAGES_SCHEMA_DEFINITION);

const Language = mongoose.model('Language', languagesSchema);

module.exports = Language;
