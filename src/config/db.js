const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pos_erp';

  // A bad URI (wrong host, firewall, typo) should fail loudly within a few
  // seconds, not hang on mongoose's much longer default server-selection
  // timeout — especially important for a container health check or a CI
  // job that needs to know quickly that something's wrong, not eventually.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`MongoDB connected -> ${uri.replace(/\/\/[^@]+@/, '//<credentials>@')}`); // never log a URI's embedded username/password

  // These fire for the LIFETIME of the process, not just at startup — a
  // network blip hours into running should be visible in logs, not silent.
  mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected — mongoose will attempt to reconnect automatically.'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'));
}

module.exports = connectDB;
