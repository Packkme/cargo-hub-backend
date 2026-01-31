const VehicleService = require('../services/VehicleService');
const requestContext = require('../utils/requestContext');

// GET /vehicles
exports.getAllVehicles = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const result = await VehicleService.getAllVehicles(operatorId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /vehicles/search
exports.searchVehicles = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const { query = "", page = 1, limit = 10 } = req.body;
    const result = await VehicleService.searchVehicles(operatorId, query, page, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /vehicles
exports.createVehicle = async (req, res) => {
  const userId = req.user._id;

  try {
    const operatorId = requestContext.getOperatorId(req);

    if (!operatorId) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const vehicle = await VehicleService.createVehicle(operatorId, req.body, userId);

    res.status(201).json(vehicle);
  } catch (err) {
    logger.error('CREATE_VEHICLE_ERROR', {
      message: err.message,
      stack: err.stack,
      userId,
      operatorId: requestContext.getOperatorId(req),
    });

    res.status(400).json({ error: err.message });
  }
};

// PUT /vehicles/:id
exports.updateVehicle = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const vehicle = await VehicleService.updateVehicle(operatorId, req.params.id, req.body);
    res.json(vehicle);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
};

// DELETE /vehicles/:id
exports.deleteVehicle = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const result = await VehicleService.deleteVehicle(operatorId, req.params.id);
    res.json(result);
  } catch (err) {
    if (err.message === 'Vehicle not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};
