const Branch = require('../models/Branch');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');

exports.createBranch = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    const userId = req.user._id;

    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ message: 'Operator ID is required' });
    }

    const { name, address, phone, manager, status } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Branch name is required' });
    }

    const branch = new Branch({
      name,
      address,
      phone,
      manager,
      status,
      operatorId,
      createdBy: userId,
    });

    await branch.save();

    res.status(201).json({ message: 'Branch created successfully', branch });
  } catch (error) {
    logger.error('CREATE_BRANCH_ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all branches
exports.getBranches = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();

    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ message: 'Operator ID is required' });
    }

    // Count all branches (regardless of status)
    const totalCount = await Branch.countDocuments({ operatorId });

    // Count only active branches
    const activeCount = await Branch.countDocuments({ operatorId, status: "Active" });

    // Get all active branches to return in data
    const branches = await Branch.find({ operatorId, status: "Active" });

    res.status(200).json({
      data: branches,
      counts: {
        total: totalCount,
        active: activeCount,
        inactive: totalCount - activeCount,
      },
    });
  } catch (error) {
    logger.error('GET_BRANCHES_ERROR:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get a branch by ID
exports.getBranchById = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    
    res.status(200).json(branch);
  } catch (error) {
    logger.error('GET_BRANCH_ERROR:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update branch
exports.updateBranch = async (req, res) => {
  try {
    const { name, address, phone, manager, status } = req.body;
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      { name, address, phone, manager, status },
      { new: true }
    );

    if (!branch) return res.status(404).json({ message: 'Branch not found' });

    res.status(200).json(branch);
  } catch (error) {
    logger.error('UPDATE_BRANCH_ERROR:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete branch
exports.deleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.id);
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    res.status(200).json({ message: 'Branch deleted successfully' });
  } catch (error) {
    logger.error('DELETE_BRANCH_ERROR:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Search branches with pagination and name query
exports.searchBranches = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ message: 'Operator ID is required' });
    }

    const { query = "", limit = 10, page = 1 } = req.body;

    const searchCondition = {
      operatorId, // Filter by current operator
      name: { $regex: query, $options: "i" },
    };

    const skip = (page - 1) * limit;

    const total = await Branch.countDocuments(searchCondition);

    const branches = await Branch.find(searchCondition)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: branches,
    });
  } catch (error) {
    logger.error("SEARCH_BRANCHES_ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
