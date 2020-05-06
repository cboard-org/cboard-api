'use strict';

const { google } = require('googleapis');
const analyticsreporting = google.analyticsreporting('v4');

module.exports = {
  batchGet: batchGet
};

async function batchGet(req, res) {
  const scopes = ['https://www.googleapis.com/auth/analytics'];
  const auth = new google.auth.GoogleAuth({ scopes: scopes });
  const authClient = await auth.getClient();

  try {
    const report = await analyticsreporting.reports.batchGet({
      auth: authClient,
      requestBody: {
        reportRequests: [
          {
            viewId: '162469865',
            dateRanges: [
              {
                startDate: '37daysAgo',
                endDate: 'today'
              }
            ],
            metrics: [
              {
                expression: 'ga:totalEvents'
              }
            ],
            dimensions: [
              {
                name: 'ga:clientId'
              }, { name: 'ga:date' }
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
