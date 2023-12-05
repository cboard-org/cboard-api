const mongoose = require('mongoose');
const { stringify } = require('yamljs');
const Schema = mongoose.Schema;

const UPDATES_SCHEMA_DEFINITION = {
  id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  time: {
    type: Date,
    default: Date.now,
  },
};

const UPDATES_SCHEMA_OPTIONS = {
  toObject: {
    virtuals: true,
  },
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
    },
  },
};

const updatesSchema = new Schema(
  UPDATES_SCHEMA_DEFINITION,
  UPDATES_SCHEMA_OPTIONS
);

const Updates = mongoose.model('Updates', updatesSchema);

module.exports = Updates;
