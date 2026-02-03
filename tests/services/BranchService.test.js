const mongoose = require('mongoose');
const { connect, closeDatabase, clearDatabase } = require('../testHelpers');
const Branch = require('../../models/Branch');
const BranchService = require('../../services/BranchService');
const logger = require('../../utils/logger');

jest.mock('../../utils/logger');

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await closeDatabase();
});

afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});

describe('BranchService.createBranch', () => {
  it('should create a new branch with valid data', async () => {
    const branchData = {
      name: "Mumbai Hub",
      address: "Mumbai, MH",
      phone: "9004994955",
      manager: "ram",
      status: "Active",
      operatorId: new mongoose.Types.ObjectId(),
    };

    const branch = await BranchService.createBranch(branchData);

    expect(branch).toBeDefined();
    expect(branch.name).toBe(branchData.name);
    expect(branch.phone).toBe(branchData.phone);
  });

  it('should throw an error when required fields are missing', async () => {
    const incompleteData = {
      address: "Some Address",
      phone: "1234567890",
    };

    await expect(BranchService.createBranch(incompleteData)).rejects.toThrow();
  });
});
