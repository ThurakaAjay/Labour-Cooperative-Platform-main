const mongoose = require('mongoose');
const dns = require('dns');

// DB Connection
let memoryServer = null;

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowMemoryFallback = process.env.ALLOW_IN_MEMORY_DB === 'true' || process.env.NODE_ENV === 'test';
  const primaryUri = process.env.MONGODB_URI || (isProduction ? null : 'mongodb://127.0.0.1:27017/workhive');

  if (isProduction && !process.env.MONGODB_URI) {
    const fatalErr = new Error('[MongoDB] Fatal: MONGODB_URI environment variable is required in production.');
    console.error(fatalErr.message);
    throw fatalErr;
  }

  try {
    // Attempt connecting to specified MongoDB instance
    await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`[MongoDB] Connected to database successfully at ${primaryUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    return mongoose.connection;
  } catch (err) {
    console.error(`[MongoDB] Failed to connect to primary database (${err.message}).`);

    // In production or when in-memory fallback is disabled, FAIL LOUDLY
    if (isProduction || !allowMemoryFallback) {
      console.error('[MongoDB] In-memory database fallback is disabled. Server will fail loudly to prevent silent data loss.');
      throw err;
    }

    // Only in development/test when explicitly permitted:
    console.warn(`[MongoDB] WARNING: Falling back to temporary in-memory MongoDB (ALLOW_IN_MEMORY_DB=true). Data will NOT persist across restarts!`);

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'workhive'
        }
      });
      const memUri = memoryServer.getUri();
      await mongoose.connect(memUri);
      console.log(`[MongoDB] Embedded in-memory MongoDB engine connected at ${memUri}`);
      return mongoose.connection;
    } catch (memErr) {
      console.error('[MongoDB] Fatal: Failed to initialize in-memory MongoDB engine:', memErr.message);
      throw memErr;
    }
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

module.exports = { connectDB, disconnectDB };
