#!/usr/bin/env node
/**
 * One-shot cleanup script: deletes all sample/test alerts and API states
 * from the MongoDB database pointed to by MONGODB_URI in .env.
 *
 * Usage: node scripts/clean-sample-data.js
 */
const dns = require('node:dns');
// DNS workaround for this machine: node's resolver can't reach the default
// DNS server to resolve the Atlas SRV record. Point it at LAN + Google DNS.
dns.setServers(['192.168.0.1', '8.8.8.8']);

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`Connected to ${uri.replace(/:[^:]+@/, ':***@')}`);

  const db = mongoose.connection.db;
  const alertRes = await db.collection('alerts').deleteMany({});
  const stateRes = await db.collection('apistates').deleteMany({});
  const configRes = await db.collection('apiconfigs').deleteMany({});

  console.log(`Deleted: ${alertRes.deletedCount} alerts, ${stateRes.deletedCount} API states, ${configRes.deletedCount} API configs`);
  await mongoose.disconnect();
  console.log('Done — database is clean.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
