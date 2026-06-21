// settings.js

const Settings = require('../models/Settings');

module.exports = {
  updateSettings: updateSettings,
  getSettings: getSettings
};

// --- NEW HELPER FUNCTION FOR SECURITY ---
// This ensures the secret key is never sent to the frontend.
function getSafeSettingsResponse(settings) {
    // Convert to a plain object to ensure access to all fields
    const response = settings.toJSON ? settings.toJSON() : settings;
    
    // The key is present here because we forced Mongoose to select it.
    const elevenlabsKey = response.elevenlabsApiKey; 

    return {
        ...response,
        // 1. Explicitly remove the key from the response object
        elevenlabsApiKey: undefined, 
        
        // 2. Add safe flags/previews for the frontend
        elevenlabsKeySet: !!elevenlabsKey, 
        elevenlabsKeyPreview: elevenlabsKey ? elevenlabsKey.slice(-4) : null 
    };
}
// ----------------------------------------


async function updateSettings(req, res) {
  if (!req.user) {
    return res
      .status(400)
      .json({ message: 'Are you logged in? Is bearer token present?' });
  }

  // NOTE: Assuming getOrCreate now accepts a second argument (true) 
  // to force Mongoose to select the secret elevenlabsApiKey field.
  const userSettings = await Settings.getOrCreate(req.user, true); 
  const { body } = req;

  if (body.user && body.user !== req.user.id) {
    body.user = req.user.id;
  }

  if (body.id) {
    delete body.id;
  }

  // --- START CHANGES FOR ELEVENLABS KEY ---
  if (body.elevenlabsApiKey !== undefined) {
    const trimmedKey = body.elevenlabsApiKey.trim();
    // Save empty strings/cleared fields as null in the database.
    userSettings.elevenlabsApiKey = trimmedKey || null; 
    
    // Remove from the body so the generic loop below doesn't overwrite it
    delete body.elevenlabsApiKey;
  }
  // --- END CHANGES FOR ELEVENLABS KEY ---

  // This loop handles all other settings properties generically
  for (let key in body) {
    userSettings[key] = body[key];
  }

  try {
    const settings = await Settings.findByIdAndUpdate(
      userSettings.id,
      userSettings,
      { 
          new: true,
          // CRUCIAL: Force the key to be selected in the final response document 
          select: '+elevenlabsApiKey' 
      }
    ).exec();
    
    // --- USE THE SAFE RESPONSE HELPER ---
    return res.status(200).json(getSafeSettingsResponse(settings));
  } catch (err) {
    return res.status(409).json({
      message: 'Error saving settings',
      error: err.message
    });
  }
}

async function getSettings(req, res) {
  if (!req.user) {
    return res
      .status(400)
      .json({ message: 'Are you logged in? Is bearer token present?' });
  }

  // NOTE: Fetch the document, passing 'true' to ensure the secret key is selected.
  const response = await Settings.getOrCreate(req.user, true);

  // --- USE THE SAFE RESPONSE HELPER ---
  return res.status(200).json(getSafeSettingsResponse(response));
}