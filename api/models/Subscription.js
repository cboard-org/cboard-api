'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PLANS_SCHEMA_DEFINITION = {
  name: {
    type: String,
    unique: true,
    required: true,
    trim: true,
  },
  planId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    trim: true,
  },
  countries: [
    {
      type: Schema.Types.Mixed,
      required: true,
      trim: true,
    },
  ],
  period: {
    type: String,
    required: true,
    trim: true,
  },
  renovation: {
    type: String,
    required: true,
    trim: true,
  },
  tags: [
    {
      type: String,
      required: true,
      trim: true,
    },
  ],
  paypalId: {
    type: String,
    trim: true,
    unique: true,
  },
};

const plansSchema = new Schema(PLANS_SCHEMA_DEFINITION, {
  autoIndex: false,
  timestamps: true,
});

const SUBSCRIPTIONS_SCHEMA_DEFINITION = {
  subscriptionId: {
    type: String,
    unique: true,
    dropDups: true,
    required: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    trim: true,
  },
  platform: {
    type: String,
    required: true,
    trim: true,
  },
  benefits: [
    {
      type: String,
      trim: true,
    },
  ],
  plans: [{ type: plansSchema }],
};

const subscriptionsSchema = new Schema(SUBSCRIPTIONS_SCHEMA_DEFINITION, {
  timestamps: true,
});

const Subscription = mongoose.model('Subscription', subscriptionsSchema);

module.exports = Subscription;
