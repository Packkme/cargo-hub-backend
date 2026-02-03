const mongoose = require('mongoose');
let mongoServer;
let usingExternalMongo = false;
let patchedListen = false;

const forceLocalhostListen = () => {
  if (patchedListen) return;
  const net = require('net');
  const originalListen = net.Server.prototype.listen;
  net.Server.prototype.listen = function (...args) {
    if (typeof args[0] === 'number') {
      const hasHost = typeof args[1] === 'string';
      if (!hasHost) {
        return originalListen.call(this, args[0], '127.0.0.1', ...args.slice(1));
      }
    }
    return originalListen.apply(this, args);
  };
  patchedListen = true;
};

const connect = async () => {
  const externalUri = process.env.MONGODB_URI;
  if (externalUri) {
    usingExternalMongo = true;
    await mongoose.connect(externalUri);
    return;
  }

  forceLocalhostListen();
  const { MongoMemoryServer } = require('mongodb-memory-server');
  mongoServer = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1' },
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
};

const closeDatabase = async () => {
  if (!usingExternalMongo) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
};

const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

module.exports = {
  connect,
  closeDatabase,
  clearDatabase,
};
