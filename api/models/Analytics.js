const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ANALYTICS_SCHEMA_DEFINITION = {
  user: {
    type: Object
  },
  time: {
    type: Date
  },
  action: {
    type: String,
    trim: true
  },
  locale: {
    type: String,
    trim: true
  },
  source: {
    type: String
  },
  payload: {
    type: Object
  }
};

const ANALYTICS_SCHEMA_OPTIONS = {
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

const analyticsSchema = new Schema(
  ANALYTICS_SCHEMA_DEFINITION,
  ANALYTICS_SCHEMA_OPTIONS
);

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;
