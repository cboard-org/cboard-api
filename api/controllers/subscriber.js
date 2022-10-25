const moment = require('moment');
const ObjectId = require('mongoose').Types.ObjectId;

const Subscriber = require('../models/Subscribers');

module.exports = {
  createSubscriber,
  deleteSubscriber,
  postTransaction
};

function createSubscriber(req, res) {
  const newSubscriber = req.body;
  const actualMoment = moment().format();
  newSubscriber.createdAt = actualMoment;
  newSubscriber.updatedAt = actualMoment;
  newSubscriber.product.createdAt = actualMoment;
  newSubscriber.product.updatedAt = actualMoment;
  const subscriber = new Subscriber(newSubscriber);
  subscriber.save(function(err, subscriber) {
    if (err) {
      console.log('error', err);
      return res.status(409).json({
        message: 'Error saving subscriber',
        error: err.message
      });
    }
    return res.status(200).json(subscriber.toJSON());
  });
}

function deleteSubscriber(req, res) {
  const subscriberId = req.swagger.params.id.value;

  if (!ObjectId.isValid(subscriberId)) {
    return res.status(400).json({
      error: {
        message: 'Invalid ID for subscriber. Subscriber Id: ' + subscriberId
      }
    });
  }

  Subscriber.findByIdAndRemove(subscriberId, function(err, subscriber) {
    if (err) {
      console.log(err);
      return res.status(200).json({
        error: {
          message: err
        }
      });
    }
    return res.status(200).json(subscriber);
  });
}

async function postTransaction(req, res) {
  const subscriberId = req.swagger.params.id.value;
  const parseTransactionReceipt = transaction => {
    const receipt = transaction?.receipt;

    if (receipt && typeof transaction?.receipt === 'string') {
      return { ...transaction, receipt: JSON.parse(receipt) };
    }
    return transaction;
  };
  const transaction = parseTransactionReceipt(req.body.transaction);

  if (!ObjectId.isValid(subscriberId)) {
    return res.status(200).json({
      ok: false,
      data: {
        error: {
          message: 'Invalid ID for subscriber. Subscriber Id: ' + subscriberId
        }
      }
    });
  }

  Subscriber.findByIdAndUpdate(
    subscriberId,
    {
      updatedAt: moment().format(),
      transaction
    },
    { new: true },
    function(err, subscriber) {
      if (err) {
        console.log(err);
        return res.status(200).json({
          ok: false,
          data: {
            error: {
              message: err
            }
          }
        });
      }
      return res.status(200).json({
        ok: true,
        data: {
          transaction: subscriber.transaction
        }
      });
    }
  );
}
