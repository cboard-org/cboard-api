const Updates = require('../models/Updates');

module.exports = {
  getUpdates: getUpdates
};


async function getUpdates(req, res) {
  try {
    const updates = await Updates.find().exec();

    const response = updates.map((update) => ({
      id: update.id,
      title: update.title,
      content: update.content,
      time: update.time,
    }));

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving updates', error: err.message });
  }
}
