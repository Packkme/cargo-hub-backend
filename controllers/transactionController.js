// controllers/transactionController.js
const transactionService = require('../services/transactionService');

exports.getUserTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.body;

    const { transactions, totalCount } = await transactionService.getTransactionsByOperator(
      req.user.operatorId, 
      req.body.userId,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      data: transactions,
      page: parseInt(page),
      limit: parseInt(limit),
      totalCount
    });
  } catch (err) {
    console.error('Failed to fetch transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};
