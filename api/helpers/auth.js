const jwt = require('jsonwebtoken');
const config = require('../../config');

const { secret: jwtSecret, issuer, publicKey } = config.jwt;

const getTokenData = token => {
  let data = null;

  try {
    data = jwt.verify(token, jwtSecret);
  } catch (err) {}

  return data;
};

const getSsoTokenData = token => {
  let data = null;

  try {
    data = jwt.verify(token, publicKey);
  } catch (err) {
    console.warn(err)
  }

  return data;
};

const authorizeRequest = (req, { role }) => {
  // These are the scopes/roles defined for the current endpoint
  const currentScopes = req.swagger.operation['x-security-scopes'];

  let isAuthorized = !currentScopes || !currentScopes.length;

  // It has scopes/roles defined?
  if (!isAuthorized) {
    isAuthorized = currentScopes.indexOf(role) >= 0;
  }

  return isAuthorized;
};

// Here we setup the security checks for the endpoints
// that need it (in our case, only /protected). This
// function will be called every time a request to a protected
// endpoint is received
const verifyToken = (req, token) => {
  let isValid = false;
  // Validate the 'Authorization' header. it should have the following format:
  // 'Bearer <tokenString>'
  if (token && token.indexOf('Bearer ') == 0) {
    const tokenString = token.split(' ')[1];
    const decodedToken = getTokenData(tokenString);
    const { id, email, issuer } = decodedToken || {};
    if (id && email && issuer && issuer === config.jwt.issuer) {
      isValid = true;
      req.auth = decodedToken;
    }
  }

  return isValid;
};

const issueToken = ({ email, id }) => {
  return jwt.sign({ email, id, issuer }, jwtSecret);
};

module.exports = {
  getTokenData,
  getSsoTokenData,
  authorizeRequest,
  verifyToken,
  issueToken
};
