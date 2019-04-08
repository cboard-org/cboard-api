const LanguagesModel = require('../api/models/Languages');
const languages = require('./laguages.json');

module.exports = async () => {
  const languagesDefaultData = await LanguagesModel.find();
  if (languagesDefaultData.length === 0) {
    console.log(`>>> Creating (${languages.length}) languages seed <<<`);
    await Promise.all(
      languages.map(laguage => {
        const newLanguage = new LanguagesModel(laguage);
        return newLanguage.save();
      })
    );
    console.log(`>>> (${languages.length}) languages seed created <<<`);
  }
};
