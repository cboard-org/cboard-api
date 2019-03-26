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
module.exports = {
  listLanguage
};
