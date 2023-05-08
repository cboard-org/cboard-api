const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const config = require('../../config');

const { secret: jwtSecret, issuer } = config.jwt;

const getTokenData = (token) => {
  let data = null;

  try {
    data = jwt.verify(token, jwtSecret);
  } catch (err) {}

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

const getAuthDataFromReq = (req) => {
  const reqToken = req.get('Authorization');
  const tokenString = reqToken.split(' ')[1];
  const decodedToken = getTokenData(tokenString);
  const requestedBy = decodedToken?.id;
  if (!reqToken || !decodedToken)
    return {
      requestedBy: null,
      isAdmin: false,
    };
  return {
    requestedBy,
    isAdmin: req.user.id == requestedBy && req.user.isAdmin,
  };
};

async function gapiAuth() {
  try {
    const scopes = ['https://www.googleapis.com/auth/androidpublisher'];
    const auth = new google.auth.GoogleAuth({
      keyFile: config.GOOGLE_PLAY_CREDENTIALS,
      scopes: scopes
    });
    const authClient = await auth.getClient();
    google.options({ auth: authClient });
  } catch (error) {
    console.error('error during Google API auth', error)
  }
}


module.exports = {
  getTokenData,
  authorizeRequest,
  verifyToken,
  issueToken,
  getAuthDataFromReq,
  gapiAuth
};
