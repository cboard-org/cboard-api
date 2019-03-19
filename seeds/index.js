const LaguagesModel = require('../api/models/Laguages');
const laguages = require('./laguages.json');

module.exports = async () => {
  const laguagesDefaultData = await LaguagesModel.find();
  if (laguagesDefaultData.length === 0) {
    console.log(`>>> Creating (${laguages.length}) laguages seed <<<`);
    await Promise.all(
      laguages.map(laguage => {
        const newLaguage = new LaguagesModel(laguage);
        return newLaguage.save();
      })
    );
    console.log(`>>> (${laguages.length}) laguages seed created <<<`);
  }
};
