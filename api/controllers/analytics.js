'use strict';

const { google } = require('googleapis');
const analyticsreporting = google.analyticsreporting('v4');
const constants = require('../constants');

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
    const reportRequests = req.body.map(requestReport => {
      const report = {
        viewId: constants.DEFAULT_GA_VIEW,
        dateRanges: [
          {
            startDate: requestReport.startDate,
            endDate: requestReport.endDate
          }
        ],
        metrics: [
          {
            expression: `ga:${requestReport.metric}`
          }
        ],
        orderBys:
          [
            { fieldName: `ga:${requestReport.metric}`, sortOrder: "DESCENDING" }
          ],
        dimensions: [
          {
            name: 'ga:clientId'
          }, {
            name: `ga:${requestReport.dimension}`
          }
        ],
        dimensionFilterClauses: [
          {
            filters: [
              {
                dimensionName: "ga:clientId",
                operator: "EXACT",
                expressions: [requestReport.clientId]
              }
            ]
          }
        ]
      };
      if (requestReport.filter) {
        const newFilter = {
          filters: [
            {
              dimensionName: `ga:${requestReport.filter.name}`,
              operator: "EXACT",
              expressions: [requestReport.filter.value]
            }
          ]
        };
        report.dimensionFilterClauses.push(newFilter);
      }
      if (requestReport.pageSize) {
        report['pageSize'] = requestReport.pageSize;
      }
      return report;
    });
    const fullRequest = {
      requestBody: {
        reportRequests: reportRequests
      }
    };
    const report = await analyticsreporting.reports.batchGet(fullRequest);
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
    //TODO
    return res.status(200).json({});
  } catch (err) {
    return res.status(409).json({
      message: 'Error getting analytics',
      error: err.message
    });
  }
}

gapiAuth();