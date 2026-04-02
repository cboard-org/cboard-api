'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ACCESS_CLIENT_SCHEMA_DEFINITION = {
  code: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    uppercase: true
  },
  clientName: {
    type: String,
    required: true,
    trim: true
  },
  clientContact: {
    type: String,
    trim: true
  },
  brandColor: {
    type: String
  },
  rootBoardId: {
    type: Schema.Types.ObjectId,
    ref: 'Board',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isListedInApp: {
    type: Boolean,
    default: true
  },
  subscriptionStart: {
    type: Date,
    required: true
  },
  subscriptionEnd: {
    type: Date,
    required: true
  },
  accessCount: {
    type: Number,
    default: 0
  },
  lastAccessAt: {
    type: Date
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
};

const ACCESS_CLIENT_SCHEMA_OPTIONS = {
  timestamps: true,
  toObject: {
    virtuals: true
  },
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
};

const accessClientSchema = new Schema(
  ACCESS_CLIENT_SCHEMA_DEFINITION,
  ACCESS_CLIENT_SCHEMA_OPTIONS
);

accessClientSchema.index({ isActive: 1, isListedInApp: 1 });

const AccessClient = mongoose.model('AccessClient', accessClientSchema);

module.exports = AccessClient;
