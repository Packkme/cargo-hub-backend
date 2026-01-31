const OperatorService = require('../services/OperatorService');

exports.createOperator = async (req, res) => {
    try {
        const operator = await OperatorService.createOperator(req.body);
        res.status(201).json(operator);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getAllOperators = async (req, res) => {
    try {
        const operators = await OperatorService.getAllOperators();
        res.status(200).json(operators);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateOperator = async (req, res) => {
  try {
    const operatorId = req.params.id;
    const updateData = req.body;

    const updatedOperator = await OperatorService.updateOperator(operatorId, updateData);

    if (!updatedOperator) {
      return res.status(404).json({ error: 'Operator not found' });
    }

    res.status(200).json(updatedOperator);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteOperator = async (req, res) => {
  try {
    const operatorId = req.params.id;

    const deleted = await OperatorService.deleteOperator(operatorId);
    if (!deleted) {
      return res.status(404).json({ error: 'Operator not found' });
    }

    res.status(200).json({ message: 'Operator deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


exports.searchOperators = async (req, res) => {
    try {
        const { query = "", page = 1, limit = 10 } = req.body;
        const result = await OperatorService.searchOperators(query, page, limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * @route   GET /api/operators/:operatorId/payment-options
 * @desc    Get payment options for an operator
 * @access  Private
 */
exports.getPaymentOptions = async (req, res) => {
  try {
    const operatorId = req.user.operatorId;

    if (!operatorId) {
      return res.status(400).json({ message: 'Operator ID not found for the current user' });
    }

    const paymentConfig = await OperatorService.getPaymentOptions(operatorId);

    if (!paymentConfig) {
      return res.status(404).json({ message: 'Operator not found' });
    }

    res.status(200).json(paymentConfig);

  } catch (error) {
    console.error('Error fetching payment options:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
