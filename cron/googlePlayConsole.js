const {google} = require('googleapis');

const playConsole = google.androidpublisher('v3');

async function gapiAuth() {
    const scopes = ['https://www.googleapis.com/auth/androidpublisher'];
    const auth = new google.auth.GoogleAuth({ scopes: scopes });
    const authClient = await auth.getClient();
    google.options({ auth: authClient });
  }
gapiAuth();
const params = {
    packageName: 'com.unicef.cboard'
  };
playConsole.monetization.subscriptions.list(params, (err, res) => {
  if (err) {
    console.error(err);
    throw err;
  }
  console.log(`The subscription are ${res.data.subscriptions}`);
});