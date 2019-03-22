const LaguagesModel = require('../models/Laguages');

const listLaguages = async (req, res) => {
  const { lang } = req.query;
  const cond =
    lang && lang.length ? { locale: { $regex: lang, $options: 'i' } } : {};
  const laguages = await LaguagesModel.findOne(cond);
  return res.status(200).json(laguages);
};
module.exports = {
  listLaguages
};
