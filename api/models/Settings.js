const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SETTINGS_SCHEMA_DEFINITION = {
  language: {},
  speech: {},
  display: {},
  scanning: {},
  navigation: {},
  
  // --- START CHANGES FOR ELEVENLABS API KEY ---
  elevenlabsApiKey: {
    type: String,
    required: false,
    trim: true,
    // CRITICAL: Mongoose will hide this field in queries by default for security
    select: false 
  },
  // --- END CHANGES FOR ELEVENLABS API KEY ---
  
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
};

const SETTINGS_SCHEMA_OPTIONS = {
  toObject: {
    virtuals: true
  },
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      
      // We do not need to explicitly delete elevenlabsApiKey here if it's set 
      // with `select: false` in the schema definition, but this is fine.
    }
  }
};

const settingsSchema = new Schema(
  SETTINGS_SCHEMA_DEFINITION,
  SETTINGS_SCHEMA_OPTIONS
);

settingsSchema.statics = {
  // --- MODIFIED getOrCreate STATIC METHOD ---
  // Added optional 'includeSecrets' flag to force selection of secret fields (like API keys)
  getOrCreate: async function(user, includeSecrets = false) {
    let settingsQuery = this.findOne({ user: user.id });
    
    // Check if we need to include secret fields (used by the settings.js controller)
    if (includeSecrets) {
      // Force selection of the secret key before executing the query
      settingsQuery = settingsQuery.select('+elevenlabsApiKey');
    }
    
    let settings = null;
    try {
      settings = await settingsQuery.exec();
    } catch (e) {
        // Handle error finding settings
    }

    // No settings yet? We need to create them
    if (!settings) {
      settings = new Settings();
      settings.user = user.id;

      try {
        settings = await settings.save().exec();
      } catch (e) {
          // Handle error saving new settings
      }
      
      // If the settings were just created, and we need the secrets, 
      // we must run a new find query to ensure the secrets are attached.
      if (settings && includeSecrets) {
         settings = await this.findOne({ user: user.id }).select('+elevenlabsApiKey').exec();
      }
    }

    if (settings) {
      // The settings.js controller will handle sanitization via getSafeSettingsResponse,
      // so we should only call toJSON() if the controller doesn't need the secret 
      // fields (which is unlikely if includeSecrets is true).
      // Given the previous code calls toJSON, we keep it here for now, but 
      // the controller will be responsible for the final safety check.
      settings = settings.toJSON(); 
    }

    return settings;
  }
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;