const moment = require('moment');

// const Subscriber = require('../models/Subscriber');

module.exports = {
  createSubscriber,
  postTransaction
};

function createSubscriber(req, res) {
  //   const subscriber = new Subscriber(req.body);
  //   subscriber.createdAt = moment().format();
  //   subscriber.updatedAt = moment().format();
  //   subscriber.save(function(err, subscriber) {
  //     if (err) {
  //       return res.status(409).json({
  //         message: 'Error saving subscriber',
  //         error: err.message
  //       });
  //     }
  return res.status(200).json({ ok: true });
  //   });
}

function postTransaction(req, res) {}
