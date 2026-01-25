const UserService = require('../services/UserService');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * Get all users for the current operator
 */
exports.getUsers = catchAsync(async (req, res) => {
  const operatorId = req.user?.operatorId;
  const userRole = req.user?.role?.rolename;
  
  if (!operatorId && userRole !== 'Super User') {
    throw new AppError('Operator ID not found in user context', 400, 'MISSING_OPERATOR_ID');
  }

  const users = await UserService.getUsers(operatorId, userRole);
  
  res.status(200).json({
    success: true,
    status: 'success',
    data: {
      users,
      count: users.length
    }
  });
});

/**
 * Get user by ID
 */
exports.getUserById = catchAsync(async (req, res) => {
  const user = await UserService.getUserById(req.params.id);
  
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    status: 'success',
    data: {
      user
    }
  });
});

/**
 * Create a new user
 */
exports.createUser = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    const createdBy = req.user._id;

    const result = await UserService.createUser(req.body, operatorId, createdBy);

    // Respond with the full saved user document (including password and timestamps)
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error in createUser controller', {
      message: error.message,
      stack: error.stack,
      createdBy: req.user?._id || 'Unknown',
      requestBody: req.body,
    });

    res.status(400).json({ message: error.message });
  }
};


/**
 * Update user
 */
exports.updateUser = async (req, res) => {
  try {
    const updatedUser = await UserService.updateUser(req.params.id, req.body);
    res.status(200).json(updatedUser);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Invalid role ID') {
      return res.status(400).json({ message: error.message });
    }
    logger.error('Error in updateUser controller', { error: error.message });
    res.status(500).json({ message: 'Failed to update user' });
  }
};

/**
 * Delete user
 */
exports.deleteUser = async (req, res) => {
  try {
    await UserService.deleteUser(req.params.id);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }
    logger.error('Error in deleteUser controller', { error: error.message });
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

/**
 * Search users with pagination
 */
exports.searchUsers = async (req, res) => {
  const userId = req.user._id;
  try {
    const { query = "", page = 1, limit = 10 } = req.body;
    const operatorId = req.user?.operatorId;
    const operatorIdFromPayload = req.body.operatorId;
    
    // Get user's role information
    const userRole = req.user?.role?.rolename;
    
    const result = await UserService.searchUsers({
      query,
      page: Number(page),
      limit: Number(limit),
      operatorId,
      operatorIdFromPayload,
      userRole,
      createdBy: userId
    });

    res.json(result);
  } catch (error) {
    logger.error('Error in searchUsers controller', { error: error.message });
    res.status(500).json({ message: 'Failed to search users' });
  }
};

/**
 * Get today's cargo balance for the current user
 */
exports.getTodayCargoBalance = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await UserService.getTodayCargoBalance(userId);
    res.json(result);
  } catch (error) {
    logger.error('Error in getTodayCargoBalance controller', { error: error.message });
    res.status(500).json({ message: 'Failed to get cargo balance' });
  }
};

/**
 * Get users 
 */
exports.getUserNames = catchAsync(async (req, res) => {
  const userRole = req.user?.role?.rolename;
  const operatorId = req.user?.operatorId;
  const users = await UserService.getUserNameByOperator(operatorId, userRole);
  // Map to only return userId and userName
  const mappedUsers = users.map(user => ({
    userId: user._id.toString(),
    userName: user.fullName
  }));
  
  res.status(200).json({
    success: true,
    status: 'success',
    data: {
      users: mappedUsers,
      count: mappedUsers.length
    }
  });
});
