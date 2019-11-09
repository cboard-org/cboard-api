const Analytics = require('../models/Analytics');

module.exports = {
  saveAnalytics
};

async function saveAnalytics(req, res) {
  const analytics = new Analytics(req.body);
  analytics.save(function(err, analytics) {
    if (err) {
      return res.status(409).json({
        message: 'Error saving analytics',
        error: err.message
      });
    }
    return res.status(200).json(analytics.toJSON());
  });
}
