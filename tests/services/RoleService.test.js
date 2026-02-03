const mongoose = require('mongoose');
const { connect, closeDatabase, clearDatabase } = require('../testHelpers');
const RoleService = require('../../services/RoleService');
const Role = require('../../models/Role');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('RoleService.createRole', () => {
  it('should create a new role with valid data', async () => {
    const roleData = {
      rolename: "Admin",
      description: "Organization Access",
      permissions: [],
    };
    const createdBy = new mongoose.Types.ObjectId();

    const role = await RoleService.createRole(roleData, createdBy);

    expect(role).toBeDefined();
    expect(role._id).toBeDefined();
    expect(role.rolename).toBe(roleData.rolename);
    expect(role.description).toBe(roleData.description);
    expect(role.permissions.length).toBe(0);
    expect(role.createdBy.toString()).toBe(createdBy.toString());
  });

  it('should throw an error if required fields are missing', async () => {
    await expect(RoleService.createRole({}, null))
      .rejects.toThrow('Rolename, description, and createdBy are required');
  });
});
