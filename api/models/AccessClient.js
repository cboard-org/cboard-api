'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ACCESS_CLIENT_MEMBER_SCHEMA = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { _id: false }
);

const ACCESS_CLIENT_SCHEMA_DEFINITION = {
  slug: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  contact: {
    name: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    }
  },
  brandColor: {
    type: String,
    default: '#1976d2'
  },
  isActive: {
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
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: {
    type: [ACCESS_CLIENT_MEMBER_SCHEMA],
    default: []
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
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
};

const accessClientSchema = new Schema(
  ACCESS_CLIENT_SCHEMA_DEFINITION,
  ACCESS_CLIENT_SCHEMA_OPTIONS
);

accessClientSchema.index({ 'members.userId': 1 });

const AccessClient = mongoose.model('AccessClient', accessClientSchema);

module.exports = AccessClient;
