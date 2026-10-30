'use strict';
const {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} = require('node:crypto');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const sign = (key, timestamp, nonce, body, path) =>
  createHmac('sha256', key)
    .update(`POST.${path}.${timestamp}.${nonce}.`)
    .update(body)
    .digest('hex');
const check = (ok, message, status = 400) => {
  if (!ok) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }
};
const active = (record, now = Date.now()) =>
  record?.state === 'active' &&
  Date.parse(record.startsAt) <= now &&
  Date.parse(record.endsAt) > now;
const isInstitutionalEvent = (event) => {
  const object = event?.data?.object;
  return (
    (object?.metadata?.purpose ??
      object?.parent?.subscription_details?.metadata?.purpose) ===
    'institutional-subscription'
  );
};
function createBridge({ product, db, accountExists, env = process.env }) {
  const enabled = () => env.INSTITUTIONAL_LICENSING_ENABLED === 'true';
  const key = () => {
    check(enabled(), 'Institutional licensing is disabled', 503);
    check(
      env.INSTITUTIONS_HMAC_KEY?.length >= 32,
      'Configure INSTITUTIONS_HMAC_KEY with a dedicated product key',
      503,
    );
    return env.INSTITUTIONS_HMAC_KEY;
  };
  async function migrate() {
    await db
      .collection('institutionalNonces')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db
      .collection('institutionalEntitlements')
      .createIndex({ userId: 1, state: 1, endsAt: 1 });
  }
  async function verify(headers, raw) {
    const get = (name) =>
      typeof headers.get === 'function' ? headers.get(name) : headers[name];
    const timestamp = get('x-institution-timestamp') || '',
      nonce = get('x-institution-nonce') || '',
      signature = get('x-institution-signature') || '';
    check(get('x-institution-product') === product, 'Product mismatch', 401);
    check(
      /^\d{13}$/.test(timestamp) &&
        Math.abs(Date.now() - Number(timestamp)) < 300000 &&
        /^[a-zA-Z0-9_-]{16,128}$/.test(nonce),
      'Expired service request',
      401,
    );
    const expected = sign(
      key(),
      timestamp,
      nonce,
      raw,
      '/api/institutions/entitlements',
    );
    check(
      /^[a-f0-9]{64}$/.test(signature) &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
      'Invalid service signature',
      401,
    );
    try {
      await db
        .collection('institutionalNonces')
        .insertOne({ _id: nonce, expiresAt: new Date(Date.now() + 600000) });
    } catch (e) {
      if (e.code === 11000) {
        check(false, 'Service request replayed', 401);
      }
      throw e;
    }
  }
  async function synchronize(headers, raw) {
    await verify(headers, raw);
    const payload = JSON.parse(raw.toString());
    for (const field of [
      'assignmentId',
      'agreementId',
      'institutionId',
      'userId',
    ])
      check(
        typeof payload[field] === 'string' &&
          payload[field].length > 0 &&
          payload[field].length <= 200,
        `Invalid ${field}`,
      );
    check(
      payload.product === product &&
        ['active', 'revoked'].includes(payload.state) &&
        ['institution', 'individual'].includes(payload.payer),
      'Invalid entitlement',
    );
    check(
      Number.isSafeInteger(payload.revision) && payload.revision > 0,
      'Invalid entitlement revision',
    );
    check(
      Number.isFinite(Date.parse(payload.startsAt)) &&
        Date.parse(payload.endsAt) > Date.parse(payload.startsAt),
      'Invalid entitlement period',
    );
    check(
      await accountExists(payload.userId),
      'Product account not found',
      404,
    );
    const collection = db.collection('institutionalEntitlements');
    const content = {
      assignmentId: payload.assignmentId,
      agreementId: payload.agreementId,
      institutionId: payload.institutionId,
      userId: payload.userId,
      product,
      revision: payload.revision,
      startsAt: new Date(payload.startsAt).toISOString(),
      endsAt: new Date(payload.endsAt).toISOString(),
      state: payload.state,
      payer: payload.payer,
    };
    const document = {
      _id: payload.assignmentId,
      ...content,
      contentHash: digest(JSON.stringify(content)),
      syncedAt: new Date(),
    };
    let existing = await collection.findOne({ _id: payload.assignmentId });
    if (!existing) {
      try {
        await collection.insertOne(document);
        return { synchronized: true, revision: payload.revision };
      } catch (e) {
        if (e.code !== 11000) throw e;
        existing = await collection.findOne({ _id: payload.assignmentId });
      }
    }
    check(
      existing.userId === payload.userId &&
        existing.institutionId === payload.institutionId &&
        existing.agreementId === payload.agreementId,
      'Entitlement ownership cannot be transferred',
      409,
    );
    if (existing.revision === payload.revision)
      check(
        existing.contentHash === document.contentHash,
        'Conflicting content for an immutable revision',
        409,
      );
    if (existing.revision >= payload.revision)
      return {
        synchronized: true,
        revision: existing.revision,
        stale: existing.revision > payload.revision,
      };
    const result = await collection.updateOne(
      { _id: payload.assignmentId, revision: existing.revision },
      { $set: document },
    );
    check(
      result.modifiedCount === 1,
      'Concurrent entitlement update; retry with current revision',
      409,
    );
    return { synchronized: true, revision: payload.revision };
  }
  async function entitlements(userId) {
    if (!enabled()) return [];
    return db
      .collection('institutionalEntitlements')
      .find(
        {
          userId,
          state: 'active',
          startsAt: { $lte: new Date().toISOString() },
          endsAt: { $gt: new Date().toISOString() },
        },
        { projection: { contentHash: 0 } },
      )
      .toArray();
  }
  async function request(path, payload) {
    const secret = key();
    check(
      env.CBOARD_INSTITUTIONS_URL,
      'Configure CBOARD_INSTITUTIONS_URL',
      503,
    );
    const url = new URL(path, env.CBOARD_INSTITUTIONS_URL);
    check(
      url.protocol === 'https:' || env.NODE_ENV !== 'production',
      'Institutional service requires HTTPS in production',
      503,
    );
    const raw = Buffer.from(JSON.stringify(payload)),
      timestamp = String(Date.now()),
      nonce = randomBytes(16).toString('hex');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-institution-product': product,
        'x-institution-timestamp': timestamp,
        'x-institution-nonce': nonce,
        'x-institution-signature': sign(
          secret,
          timestamp,
          nonce,
          raw,
          url.pathname + url.search,
        ),
      },
      body: raw,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: 'Institutional service unavailable' }));
      check(
        false,
        error.message || 'Institutional request failed',
        response.status,
      );
    }
    return response.status === 202 ? { queued: true } : response.json();
  }
  return { migrate, synchronize, entitlements, request, enabled };
}
module.exports = { createBridge, active, sign, isInstitutionalEvent };
