'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PRODUCT_SCHEMA_DEFINITION = {
  planId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
  },
  subscriptionId: {
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
  createdAt: {
    type: Date,
    required: true,
  },
  updatedAt: {
    type: Date,
    required: true,
  },
};

const productSchema = new Schema(PRODUCT_SCHEMA_DEFINITION, {
  autoIndex: false,
  strict: true,
});

const SUBSCRIBERS_SCHEMA_DEFINITION = {
  userId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
  },
  country: {
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
  createdAt: {
    type: Date,
    required: true,
  },

  updatedAt: {
    type: Date,
    required: true,
  },
  // transaction: { type: transactionSchema },
  transaction: {},
  product: {
    type: productSchema,
  },
};

const subscribersSchema = new Schema(SUBSCRIBERS_SCHEMA_DEFINITION, {
  autoIndex: false,
  strict: true,
});

const Subscribers = mongoose.model('Subscribers', subscribersSchema);

module.exports = Subscribers;
