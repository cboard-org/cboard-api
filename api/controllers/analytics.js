'use strict';

const { google } = require('googleapis');
const analyticsreporting = google.analyticsreporting('v4');

module.exports = {
  batchGet: batchGet,
  userActivity: userActivity
};

async function gapiAuth() {
  const scopes = ['https://www.googleapis.com/auth/analytics'];
  const auth = new google.auth.GoogleAuth({ scopes: scopes });
  const authClient = await auth.getClient();
  google.options({ auth: authClient });
}

async function batchGet(req, res) {
  try {
    const report = await analyticsreporting.reports.batchGet({
      requestBody: {
        reportRequests: [
          {
            viewId: '162469865',
            dateRanges: [
              {
                startDate: req.body.startDate,
                endDate: req.body.endDate
              }
            ],
            metrics: [
              {
                expression: `ga:${req.body.metric}`
              }
            ],
            dimensions: [
              {
                name: 'ga:clientId'
              }, { name:  `ga:${req.body.dimension}` }
            ],
            "dimensionFilterClauses": [
              {
                "filters": [
                  {
                    "dimensionName": "ga:clientId",
                    "operator": "EXACT",
                    "expressions": ["1635071876.1577121026"]
                  }
                ]
              }
            ]
          },
        ],
      },
    });
    return res.status(200).json(report.data);
  } catch (err) {
    return res.status(409).json({
      message: 'Error getting analytics',
      error: err.message
    });
  }
}

async function userActivity(req, res) {
  try {
    const report = await analyticsreporting.userActivity.search({
      "viewId": "162469865",
      "dateRange": {
        "startDate": "2020-05-02",
        "endDate": "2020-05-02"
      },
      "user": {
        "type": "CLIENT_ID",
        "userId": "1635071876.1577121026"
      }
    });
    return res.status(200).json(report.data);
  } catch (err) {
    return res.status(409).json({
      message: 'Error getting analytics',
      error: err.message
    });
  }
}

gapiAuth();