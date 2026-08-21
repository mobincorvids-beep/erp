const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pos_erp';

  // A bad URI (wrong host, firewall, typo) should fail loudly within a few
  // seconds, not hang on mongoose's much longer default server-selection
  // timeout — especially important for a container health check or a CI
  // job that needs to know quickly that something's wrong, not eventually.
  //
  // maxPoolSize/minPoolSize matter once this runs as N API replicas against
  // one MongoDB cluster: mongoose's own default (100) is per-connection-pool,
  // i.e. per process — N replicas at the default means N×100 possible
  // concurrent connections against the database, which can exhaust a
  // smaller cluster's own connection ceiling well before any single
  // replica is actually overloaded. Configurable via env so the real
  // number gets set based on actual replica count × per-replica load, not
  // guessed once and left. readPreference lets read-heavy, staleness-
  // tolerant traffic (reports, dashboards) be pointed at a replica set's
  // secondaries via MONGO_READ_PREFERENCE=secondaryPreferred, keeping the
  // primary's write capacity free for checkout/accounting — unset leaves
  // mongoose's default ('primary'), i.e. no behavior change unless opted in.
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 100,
    minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 0,
    ...(process.env.MONGO_READ_PREFERENCE ? { readPreference: process.env.MONGO_READ_PREFERENCE } : {}),
  });
  console.log(`MongoDB connected -> ${uri.replace(/\/\/[^@]+@/, '//<credentials>@')}`); // never log a URI's embedded username/password

  // These fire for the LIFETIME of the process, not just at startup — a
  // network blip hours into running should be visible in logs, not silent.
  mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected — mongoose will attempt to reconnect automatically.'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'));
}

module.exports = connectDB;
