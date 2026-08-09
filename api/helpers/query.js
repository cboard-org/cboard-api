module.exports = {
  getQuery: getQuery,
  getORQuery: getORQuery
};

// Escape regex metacharacters so user-supplied search values are matched
// literally. This prevents regex injection and ReDoS via crafted patterns.
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getQuery(property, value, regex = false) {
  const queryValue = regex
    ? { $regex: new RegExp(escapeRegExp(value), 'ig') }
    : value;

  return { [property]: queryValue };
}

function getORQuery(properties, value, regex = false) {
  return {
    $or: properties.map(p => getQuery(p, value, regex))
  };
}
