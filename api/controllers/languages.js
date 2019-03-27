const LanguagesModel = require('../models/Languages');
const { paginatedResponse } = require('../helpers/response');
const { getORQuery } = require('../helpers/query');

const listLanguage = async (req, res) => {
  const { lang } = req.query;
  const searchFields = ['locale'];
  const query = lang && lang.length ? getORQuery(searchFields, lang, true) : {};
  const laguages = await paginatedResponse(
    LanguagesModel,
    {
      query,
      populate: ['communicators', 'boards']
    },
    req.query
  );
  return res.status(200).json(laguages);
};

const getLanguage = async (req, res) => {
  const lang = req.swagger.params.lang.value;
  const cond = { locale: { $regex: lang, $options: 'i' } };
  const language = await LanguagesModel.findOne(cond);
  if (!language) {
    return res.status(404).json({
      message: `Language does not exist. Language: ${lang}`
    });
  }
  return res.status(200).json(language);
};

module.exports = {
  listLanguage,
  getLanguage
};
