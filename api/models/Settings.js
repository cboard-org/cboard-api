const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SETTINGS_SCHEMA_DEFINITION = {
  language: {},
  speech: {},
  display: {},
  scanning: {},
  navigation: {},
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
    }
  }
};

const settingsSchema = new Schema(
  SETTINGS_SCHEMA_DEFINITION,
  SETTINGS_SCHEMA_OPTIONS
);

settingsSchema.statics = {
  getOrCreate: async function(user) {
    let settings = null;
    try {
      settings = await Settings.findOne({ user: user.id }).exec();
    } catch (e) {}

    // No settings yet? We need to create them
    if (!settings) {
      settings = new Settings();
      settings.user = user.id;

      try {
        settings = await settings.save().exec();
      } catch (e) {}
    }

    if (settings) {
      settings = settings.toJSON();
    }

    return settings;
  }
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
