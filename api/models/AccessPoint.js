'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ACCESS_POINT_SCHEMA_DEFINITION = {
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true,
    index: true
  },
  accessClient: {
    type: Schema.Types.ObjectId,
    ref: 'AccessClient',
    required: true
  },
  rootBoardId: {
    type: Schema.Types.ObjectId,
    ref: 'Board',
    required: true
  },
  viewsCount: {
    type: Number,
    default: 0
  },
  lastAccessAt: {
    type: Date,
    default: null
  }
};

const ACCESS_POINT_SCHEMA_OPTIONS = {
  timestamps: true,
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

const accessPointSchema = new Schema(
  ACCESS_POINT_SCHEMA_DEFINITION,
  ACCESS_POINT_SCHEMA_OPTIONS
);

const AccessPoint = mongoose.model('AccessPoint', accessPointSchema);

module.exports = AccessPoint;
