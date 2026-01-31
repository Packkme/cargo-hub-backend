const CashTransferService = require('../services/CashTransferService');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');

// Create a new cash transfer
exports.createCashTransfer = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId(); 
    const currentUser = req.user; 

    const result = await CashTransferService.createCashTransfer(req.body, operatorId, currentUser);
    res.status(201).json({ message: 'Cash transfer created', data: result });
  } catch (err) {
    logger.error('Error creating cash transfer:', err.message);
    res.status(400).json({ message: err.message || 'Failed to create cash transfer' });
  }
};

// Get all cash transfers with optional status filtering and pagination
exports.getCashTransfers = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    const currentUser = req.user;

    const {
      status,
      page = 1,
      limit = 10
    } = req.query;

    const paginationOptions = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };

    const result = await CashTransferService.getCashTransfers(
      operatorId,
      status,
      paginationOptions,
      currentUser 
    );

    res.status(200).json(result);
  } catch (err) {
    logger.error('Error fetching cash transfers:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Get a specific cash transfer by ID
exports.getCashTransferById = async (req, res) => {
  try {
    const result = await CashTransferService.getCashTransferById(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Cash transfer not found' });
    }
    res.status(200).json(result);
  } catch (err) {
    logger.error('Error fetching cash transfer by ID:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};



// Update a pending cash transfer
exports.updateCashTransfer = async (req, res) => {
  try {
    const result = await CashTransferService.updateCashTransfer(req.params.id, req.body);
    res.status(200).json({ message: 'Transfer updated', data: result });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to update transfer' });
  }
};

// Delete a cash transfer
exports.deleteCashTransfer = async (req, res) => {
  try {
    const result = await CashTransferService.deleteCashTransfer(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Cash transfer not found' });
    }
    res.status(200).json({ message: 'Cash transfer deleted successfully' });
  } catch (err) {
    logger.error('Error deleting cash transfer:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.exportPendingTransfers = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    console.log('Operator ID:', operatorId);

    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ message: 'Operator ID not found or invalid' });
    }

    const csv = await CashTransferService.exportPendingTransfersCSV(operatorId);

    res.header('Content-Type', 'text/csv');
    res.attachment(`pending_transfers_${Date.now()}.csv`);
    res.send(csv);

  } catch (error) {
    console.error('Error exporting pending transfers:', error);
    if (error.message === 'No pending transfers found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};
