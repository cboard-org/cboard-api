'use strict';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const {
  MongoRateLimitStore,
  institutionalLimits
} = require('../../api/helpers/institutional-rate-limit');

describe('shared institutional request protection', function() {
  this.timeout(30000);
  let connection, db, originalNow;
  before(async () => {
    connection = await mongoose
      .createConnection(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017', {
        dbName: `institutional-rate-test-${randomUUID()}`
      })
      .asPromise();
    db = connection.db;
    originalNow = Date.now;
    const now = originalNow();
    Date.now = () => now;
  });
  beforeEach(async () => {
    await db.collection('institutionalRateLimits').deleteMany({});
  });
  after(async () => {
    if (originalNow) Date.now = originalNow;
    if (db) await db.dropDatabase();
    await connection?.close();
  });
  function app(env = {}, database = () => db) {
    const app = express();
    app.enable('trust proxy');
    const limits = institutionalLimits(database, env);
    app.use(limits.network);
    app.post(
      '/activation/:action',
      (req, res, next) => {
        if (req.get('Authorization') !== 'Bearer synthetic')
          return res.sendStatus(401);
        req.auth = { id: 'synthetic-account' };
        next();
      },
      limits.account,
      express.json(),
      (req, res) => res.json({ allowed: true })
    );
    app.post(
      '/entitlements',
      express.raw({ type: 'application/json' }),
      (req, res) => {
        assert.ok(Buffer.isBuffer(req.body));
        res.sendStatus(204);
      }
    );
    app.use((error, req, res, next) => res.sendStatus(503));
    return app;
  }
  it('atomically shares a budget across independent store instances and cleans up with TTL', async () => {
    const stores = [
      new MongoRateLimitStore(() => db, 'concurrent'),
      new MongoRateLimitStore(() => db, 'concurrent')
    ];
    stores.forEach(store => store.init({ windowMs: 60000 }));
    const hits = await Promise.all(
      Array.from({ length: 80 }, (_, i) => stores[i % 2].increment('synthetic'))
    );
    assert.deepEqual(
      hits.map(hit => hit.totalHits).sort((a, b) => a - b),
      Array.from({ length: 80 }, (_, i) => i + 1)
    );
    const indexes = await db.collection('institutionalRateLimits').indexes();
    assert.ok(
      indexes.some(
        index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0
      )
    );
    const records = await db
      .collection('institutionalRateLimits')
      .find()
      .toArray();
    assert.equal(records.length, 1);
    assert.ok(!records[0]._id.includes('synthetic'));
  });
  it('blocks a verified account across actions, networks and application instances before parsing', async () => {
    const apps = [
      app({ INSTITUTIONS_TRUSTED_PROXIES: '127.0.0.1/8,::1/128' }),
      app({ INSTITUTIONS_TRUSTED_PROXIES: '127.0.0.1/8,::1/128' })
    ];
    for (let i = 0; i < 30; i++)
      await request(apps[i % 2])
        .post(`/activation/${i % 2 ? 'check' : 'preview'}`)
        .set('Authorization', 'Bearer synthetic')
        .set('X-Forwarded-For', `192.0.2.${i + 1}`)
        .send({})
        .expect(200);
    const blocked = await request(apps[1])
      .post('/activation/redeem')
      .set('Authorization', 'Bearer synthetic')
      .set('Content-Type', 'application/json')
      .send('{invalid')
      .expect(429);
    assert.ok(Number(blocked.headers['retry-after']) > 0);
  });
  it('ignores spoofed forwarded headers under unrestricted application proxy trust', async () => {
    const server = app();
    for (let i = 0; i < 300; i++)
      await request(server)
        .post('/activation/check')
        .set('X-Forwarded-For', `192.0.2.${(i % 250) + 1}`)
        .expect(401);
    await request(server)
      .post('/activation/check')
      .set('X-Forwarded-For', '198.51.100.20')
      .expect(429);
  });
  it('groups IPv6 /56 addresses and ignores spoofed entries left of the first untrusted hop', async () => {
    const server = app({ INSTITUTIONS_TRUSTED_PROXIES: '127.0.0.1/8,::1/128' });
    for (let i = 0; i < 300; i++)
      await request(server)
        .post('/activation/check')
        .set(
          'X-Forwarded-For',
          `198.51.100.${(i % 250) + 1}, 2001:db8:abcd:12::${i + 1}`
        )
        .expect(401);
    await request(server)
      .post('/activation/check')
      .set('X-Forwarded-For', '2001:db8:abcd:34::1')
      .expect(429);
    await request(server)
      .post('/activation/check')
      .set('X-Forwarded-For', '2001:db8:abce::1')
      .expect(401);
  });
  it('preserves raw signed bytes and rejects unavailable protection without passing downstream', async () => {
    await request(app())
      .post('/entitlements')
      .set('Content-Type', 'application/json')
      .send('{"revision":1}')
      .expect(204);
    await request(app({}, () => undefined))
      .post('/entitlements')
      .set('Content-Type', 'application/json')
      .send('{}')
      .expect(503);
    assert.throws(
      () => app({ INSTITUTIONS_TRUSTED_PROXIES: 'true' }),
      /explicit IPs/
    );
  });
});
