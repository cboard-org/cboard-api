const getParameters = ({
  page = 1,
  limit = 10,
  offset = 0,
  sort = '-_id',
  search = ''
} = {}) => {
  return {
    page: !isNaN(page) ? parseInt(page, 10) : 1,
    limit: !isNaN(limit) ? parseInt(limit, 10) : 10,
    offset: !isNaN(offset) ? parseInt(offset, 10) : 0,
    sort: sort && sort.length ? sort : '-_id',
    search: search && search.length ? search : ''
  };
};

const paginatedResponse = async (
  model,
  { query = {}, populate = [] } = {},
  requestQuery
) => {
  let total = 0;
  let data = [];

  const { page, limit, offset, sort, search } = getParameters(requestQuery);
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
    search,
    data
  };
};

module.exports = {
  paginatedResponse
};
