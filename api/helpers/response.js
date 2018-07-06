const paginatedResponse = async (
  model,
  { query = {}, populate = [] } = {},
  { page = 1, limit = 10, offset = 0, sort = '-_id' } = {}
) => {
  let total = 0;
  let data = [];

  const skip = (page - 1) * limit + offset;
  let queryModel = model
    .find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit);

  populate.forEach(k => {
    queryModel = queryModel.populate(k);
  });

  try {
    data = await queryModel.exec();
    total = await model.count(query).exec();
  } catch (e) {}

  return {
    total,
    page,
    limit,
    offset,
    sort,
    data
  };
};

module.exports = {
  paginatedResponse
};
