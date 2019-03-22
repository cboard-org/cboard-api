'use strict';

const mongoose = require('mongoose');
const constants = require('../constants');
const Schema = mongoose.Schema;

const LAGUAGES_SCHEMA_DEFINITION = {
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

const laguagesSchema = new Schema(LAGUAGES_SCHEMA_DEFINITION);

const Laguages = mongoose.model('Laguages', laguagesSchema);

module.exports = Laguages;
