'use strict';

const { google } = require('googleapis');
const playConsole = google.androidpublisher('v3');
const constants = require('../constants');

module.exports = {
  listSubscriptions: listSubscriptions
};

async function gapiAuth() {
  const scopes = ['https://www.googleapis.com/auth/androidpublisher'];
  const auth = new google.auth.GoogleAuth({ scopes: scopes });
  const authClient = await auth.getClient();
  google.options({ auth: authClient });
}

async function listSubscriptions(req, res) {
  const params = {
    packageName: 'com.unicef.cboard'
  };
  try {
    const subscriptions = await playConsole.monetization.subscriptions.list(params);
    console.log(`The subscription are ${res.data.subscriptions}`);

    return res.status(200).json(subscriptions);
  } catch (err) {
    return res.status(409).json({
      message: 'Error getting analytics',
      error: err.message
    });
  }
}

gapiAuth();