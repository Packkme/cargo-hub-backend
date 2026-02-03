const mongoose = require('mongoose');

const { connect, closeDatabase, clearDatabase } = require('./testHelpers');
const shouldInitMongo = process.env.JEST_SETUP_MONGO === 'true';

if (shouldInitMongo) {
  beforeAll(async () => {
    await connect();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });
}

// Helper function to create test operator
const createTestOperator = async () => {
  const Operator = require('../models/Operator');
  return await Operator.create({
    name: 'Test Operator',
    code: 'TST',
    phone: '9876543210',
    address: 'Test Address'
  });
};

// Helper function to create test user
const createTestUser = async (operatorId, overrides = {}) => {
  const User = require('../models/User');
  const bcrypt = require('bcryptjs');
  
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  return await User.create({
    fullName: 'Test User',
    mobile: '9876543210',
    password: hashedPassword,
    operatorId,
    status: 'Active',
    ...overrides
  });
};

// Helper function to create test branch
const createTestBranch = async (operatorId, overrides = {}) => {
  const Branch = require('../models/Branch');
  
  return await Branch.create({
    name: 'Test Branch',
    address: 'Test Branch Address',
    phone: '9876543210',
    manager: 'Test Manager',
    operatorId,
    status: 'Active',
    ...overrides
  });
};

// Helper function to create JWT token for testing
const createTestToken = (user) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { _id: user._id, operatorId: user.operatorId },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

module.exports = {
  createTestOperator,
  createTestUser,
  createTestBranch,
  createTestToken
};
