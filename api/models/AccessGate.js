'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ACCESS_GATE_SCHEMA_DEFINITION = {
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
  },
  linkedBoardsIds: {
    type: [Schema.Types.ObjectId],
    ref: 'Board',
    default: []
  }
};

const ACCESS_GATE_SCHEMA_OPTIONS = {
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

const accessGateSchema = new Schema(
  ACCESS_GATE_SCHEMA_DEFINITION,
  ACCESS_GATE_SCHEMA_OPTIONS
);

const AccessGate = mongoose.model('AccessGate', accessGateSchema);

module.exports = AccessGate;
