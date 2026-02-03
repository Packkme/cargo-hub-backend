const mongoose = require('mongoose');
const { connect, closeDatabase, clearDatabase } = require('../testHelpers');
const VehicleService = require('../../services/VehicleService');
const Vehicle = require('../../models/Vehicle');
const Operator = require('../../models/Operator');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await closeDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

describe('VehicleService.createVehicle', () => {
  it('should create a new vehicle with valid data', async () => {
    const operator = await Operator.create({
      name: 'Test Operator',
      phone: '9876543210',
      code: 'ABC',
    });

    const vehicleData = {
      vehicleNumber: 'TN01AB1234',
      status: true,
    };

    const createdBy = new mongoose.Types.ObjectId();

    const vehicle = await VehicleService.createVehicle(operator._id, vehicleData, createdBy);

    expect(vehicle).toHaveProperty('_id');
    expect(vehicle.vehicleNumber).toBe(vehicleData.vehicleNumber);
    expect(vehicle.operatorId.toString()).toBe(operator._id.toString());
    expect(vehicle.status).toBe(true);
  });

  it('should throw an error if operator does not exist', async () => {
    const fakeOperatorId = new mongoose.Types.ObjectId();
    const vehicleData = {
      vehicleNumber: 'TN01AB1234',
    };
    const createdBy = new mongoose.Types.ObjectId();

    await expect(
      VehicleService.createVehicle(fakeOperatorId, vehicleData, createdBy)
    ).rejects.toThrow('Operator not found');
  });

  it('should throw an error if vehicle number already exists for the operator', async () => {
    const operator = await Operator.create({
      name: 'Test Operator',
      phone: '9876543210',
      code: 'XYZ',
    });

    const vehicleData = {
      vehicleNumber: 'TN01AB1234',
    };
    const createdBy = new mongoose.Types.ObjectId();

    // Create a vehicle first
    await Vehicle.create({ ...vehicleData, operatorId: operator._id });

    // Try to create the same vehicle again
    await expect(
      VehicleService.createVehicle(operator._id, vehicleData, createdBy)
    ).rejects.toThrow('Vehicle number already exists');
  });

  it('should default status to true when not provided', async () => {
    const operator = await Operator.create({
      name: 'Test Operator',
      phone: '9876543210',
      code: 'DEF',
    });

    const vehicleData = {
      vehicleNumber: 'TN01AB5678',
    };
    const createdBy = new mongoose.Types.ObjectId();

    const vehicle = await VehicleService.createVehicle(operator._id, vehicleData, createdBy);
    expect(vehicle.status).toBe(true);
  });
});
