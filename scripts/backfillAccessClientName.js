'use strict';

/**
 * One-off backfill: AccessClient.name became required. Clients created before
 * that stored the organization name in contact.name and have no `name`.
 * This copies contact.name -> name for every client missing it.
 *
 * Idempotent: safe to run more than once.
 *
 * Usage (with the target environment's MONGO_URL configured):
 *   node scripts/backfillAccessClientName.js            # apply
 *   node scripts/backfillAccessClientName.js --dry-run  # only report
 */

const mongoose = require('mongoose');
const AccessClient = require('../api/models/AccessClient');

const DRY_RUN = process.argv.includes('--dry-run');

async function backfillAccessClientName() {
  await mongoose.connection.asPromise();

  const missingName = {
    $or: [{ name: { $exists: false } }, { name: null }, { name: '' }]
  };

  // Use the raw collection so the update is not blocked by schema validation.
  const clients = await AccessClient.collection
    .find(missingName, { projection: { slug: 1, contact: 1 } })
    .toArray();

  console.log(`Found ${clients.length} access client(s) without name`);

  let updated = 0;
  const skipped = [];

  for (const client of clients) {
    const fallbackName = client.contact?.name?.trim();
    if (!fallbackName) {
      skipped.push(client.slug);
      continue;
    }
    console.log(`  ${client.slug}: name <- "${fallbackName}"`);
    if (!DRY_RUN) {
      await AccessClient.collection.updateOne(
        { _id: client._id },
        { $set: { name: fallbackName } }
      );
    }
    updated++;
  }

  console.log(
    `${DRY_RUN ? '[dry-run] Would update' : 'Updated'} ${updated} client(s)`
  );
  if (skipped.length) {
    console.warn(
      `Skipped ${skipped.length} client(s) with no contact.name, set name manually: ${skipped.join(', ')}`
    );
  }
}

if (require.main === module) {
  require('../db'); // Initialize MongoDB connection
  backfillAccessClientName()
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Backfill failed:', err);
      process.exit(1);
    });
}

module.exports = { backfillAccessClientName };
