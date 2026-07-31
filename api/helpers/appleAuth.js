const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
// Apple rotates its signing keys, so cache them for a limited time instead of
// fetching on every login.
const KEYS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

let cachedKeys = null;
let cachedKeysExpiry = 0;

async function getApplePublicKeys() {
  const now = Date.now();
  if (cachedKeys && now < cachedKeysExpiry) {
    return cachedKeys;
  }

  const { data } = await axios.get(APPLE_KEYS_URL);
  cachedKeys = (data && data.keys) || [];
  cachedKeysExpiry = now + KEYS_TTL_MS;
  return cachedKeys;
}

// Verifies the signature and standard claims of an Apple identity token against
// Apple's published public keys. Returns the decoded payload when valid and
// throws otherwise, so callers must never trust an unverified token.
async function verifyAppleIdToken(idToken, audiences) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Apple identity token');
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Invalid Apple identity token');
  }

  const keys = await getApplePublicKeys();
  const jwk = keys.find(key => key.kid === decoded.header.kid);
  if (!jwk) {
    throw new Error('No matching Apple public key found for token');
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });

  return jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: audiences
  });
}

module.exports = {
  verifyAppleIdToken
};
