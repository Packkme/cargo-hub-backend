const mongoose = require('mongoose');
const Vehicle = require('../models/Vehicle');
const Operator = require('../models/Operator');
const logger = require('../utils/logger');
const { buildOperatorFilter, appendOperatorFilter } = require('../utils/operatorFilter');

class VehicleService {
 static async getAllVehicles(operatorId) {
  const baseFilter = buildOperatorFilter(operatorId);
  const availableFilter = { ...baseFilter, status: 'Available' };
  const allFilter = baseFilter;

  const vehicles = await Vehicle.find(availableFilter).lean();
  const total = await Vehicle.countDocuments(allFilter); // all vehicles
  const availableCount = await Vehicle.countDocuments(availableFilter); // available only

  return {
    data: vehicles,
    total,
    availableCount,
  };
}

  static async searchVehicles(operatorId, query = "", page = 1, limit = 10) {
    const regex = new RegExp(query, "i");
    const skip = (page - 1) * limit;

    const queryConditions = appendOperatorFilter({ vehicleNumber: regex }, operatorId);

    const total = await Vehicle.countDocuments(queryConditions);
    const vehicles = await Vehicle.find(queryConditions).skip(skip).limit(Number(limit)).lean();

    return {
      data: vehicles,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    };
  }

 static async createVehicle(operatorId, vehicleData, createdBy) {
    logger.info('Creating new vehicle', { operatorId, vehicleData, createdBy });

    // Check if operator exists
    const operatorExists = await Operator.exists({ _id: operatorId });
    if (!operatorExists) {
      logger.warn('Operator not found', { operatorId });
      throw new Error('Operator not found');
    }

    // Check if vehicle number already exists for this operator
    const exists = await Vehicle.findOne({
      vehicleNumber: vehicleData.vehicleNumber,
      operatorId
    });

    if (exists) {
      logger.warn('Vehicle number already exists', {
        vehicleNumber: vehicleData.vehicleNumber,
        operatorId
      });
      throw new Error('Vehicle number already exists');
    }

    // Validate status or assign default
    const status = vehicleData.status || 'Available';
    const validStatuses = ['Available', 'In Transit', 'Maintenance'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid vehicle status: ${status}`);
    }

    // Create and save vehicle
    const vehicle = new Vehicle({
      ...vehicleData,
      status,
      operatorId,
      createdBy
    });

    await vehicle.save();
    logger.info('Vehicle created successfully', { vehicleId: vehicle._id });
    return vehicle;
  }

  static async updateVehicle(operatorId, vehicleId, updateData) {
    if (operatorId) {
      const operatorExists = await Operator.exists({ _id: operatorId });
      if (!operatorExists) throw new Error('Operator not found');
    }

    const vehicle = await Vehicle.findOne(appendOperatorFilter({ _id: vehicleId }, operatorId));
    if (!vehicle) throw new Error('Vehicle not found or unauthorized');

    if (updateData.status && !["Available", "In Transit", "Maintenance"].includes(updateData.status)) {
      throw new Error(`Invalid vehicle status: ${updateData.status}`);
    }

    Object.assign(vehicle, updateData);
    await vehicle.save();
    return vehicle;
  }

  static async deleteVehicle(operatorId, vehicleId) {
    const vehicle = await Vehicle.findOneAndDelete(appendOperatorFilter({ _id: vehicleId }, operatorId));
    if (!vehicle) throw new Error('Vehicle not found');

    return { message: 'Vehicle deleted successfully' };
  }
}

module.exports = VehicleService;
