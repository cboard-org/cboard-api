module.exports = {
  getQuery: getQuery,
  getORQuery: getORQuery
};

function getQuery(property, value, regex = false) {
  const queryValue = regex ? { $regex: new RegExp(value, 'ig') } : value;

  return { [property]: queryValue };
}

function getORQuery(properties, value, regex = false) {
  return {
    $or: properties.map(p => getQuery(p, value, regex))
  };
}
