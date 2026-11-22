'use strict';
const { createHash } = require('node:crypto');
const { isIP } = require('node:net');
const proxyaddr = require('proxy-addr');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const indexes = new WeakMap();
class MongoRateLimitStore {
  constructor(database, prefix) {
    this.database = database;
    this.prefix = prefix;
  }
  init({ windowMs }) {
    this.windowMs = windowMs;
  }
  async collection() {
    const db = this.database();
    if (!db) throw new Error('Rate limit database unavailable');
    if (!indexes.has(db)) {
      const ready = db
        .collection('institutionalRateLimits')
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      indexes.set(db, ready);
      ready.catch(() => indexes.delete(db));
    }
    await indexes.get(db);
    return db.collection('institutionalRateLimits');
  }
  key(key) {
    const bucket = Math.floor(Date.now() / this.windowMs);
    const digest = createHash('sha256')
      .update(key)
      .digest('hex');
    return {
      id: `${this.prefix}:${bucket}:${digest}`,
      resetTime: new Date((bucket + 1) * this.windowMs)
    };
  }
  async increment(key) {
    const collection = await this.collection();
    const { id, resetTime } = this.key(key);
    const update = {
      $inc: { hits: 1 },
      $setOnInsert: { expiresAt: resetTime }
    };
    const options = { returnDocument: 'after', includeResultMetadata: false };
    let result;
    try {
      result = await collection.findOneAndUpdate({ _id: id }, update, {
        ...options,
        upsert: true
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      result = await collection.findOneAndUpdate({ _id: id }, update, options);
    }
    if (!result) throw new Error('Rate limit counter unavailable');
    return { totalHits: result.hits, resetTime };
  }
  async decrement(key) {
    const collection = await this.collection();
    await collection.updateOne(
      { _id: this.key(key).id, hits: { $gt: 0 } },
      {
        $inc: { hits: -1 }
      }
    );
  }
  async resetKey(key) {
    const collection = await this.collection();
    await collection.deleteOne({ _id: this.key(key).id });
  }
}

function institutionalLimits(database, env = process.env) {
  const proxies = (env.INSTITUTIONS_TRUSTED_PROXIES || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  for (const proxy of proxies) {
    if (!isIP(proxy.split('/')[0]))
      throw new Error(
        'INSTITUTIONS_TRUSTED_PROXIES requires explicit IPs/CIDRs'
      );
  }
  const trust = proxyaddr.compile(proxies);
  const create = (prefix, limit, keyGenerator) =>
    rateLimit({
      windowMs: 60000,
      limit,
      keyGenerator,
      store: new MongoRateLimitStore(database, prefix),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Too many institutional requests; try again later' },
      passOnStoreError: false
    });
  return {
    network: create('network', 300, req => {
      const ip = proxyaddr(req, trust);
      if (!isIP(ip)) throw new Error('Invalid institutional client address');
      return ipKeyGenerator(ip, 56);
    }),
    account: create('account', 30, req => String(req.auth.id))
  };
}
module.exports = { MongoRateLimitStore, institutionalLimits };
