const LanguagesModel = require('../models/Languages');

const listLanguage = async (req, res) => {
  const { lang } = req.query;
  const cond =
    lang && lang.length ? { locale: { $regex: lang, $options: 'i' } } : {};
  const laguages = await LanguagesModel.findOne(cond);
  return res.status(200).json(laguages);
};
module.exports = {
  listLanguage
};
