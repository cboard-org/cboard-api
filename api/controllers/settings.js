const Settings = require('../models/Settings');

module.exports = {
  updateSettings: updateSettings,
  getSettings: getSettings
};

async function updateSettings(req, res) {
  if (!req.user) {
    return res
      .status(400)
      .json({ message: 'Are you logged in? Is bearer token present?' });
  }

  const userSettings = await Settings.getOrCreate(req.user);
  const { body } = req;

  if (body.user && body.user !== req.user.id) {
    body.user = req.user.id;
  }

  if (body.id) {
    delete body.id;
  }

  for (let key in body) {
    userSettings[key] = body[key];
  }

  try {
    const settings = await Settings.findByIdAndUpdate(
      userSettings.id,
      userSettings,
      { new: true }
    ).exec();
    return res.status(200).json(settings.toJSON());
  } catch (err) {
    return res.status(409).json({
      message: 'Error saving settings',
      error: err
    });
  }
}

async function getSettings(req, res) {
  if (!req.user) {
    return res
      .status(400)
      .json({ message: 'Are you logged in? Is bearer token present?' });
  }

  const response = await Settings.getOrCreate(req.user);

  return res.status(200).json(response);
}
