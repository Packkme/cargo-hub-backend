const RoleService = require('../services/RoleService');
const logger = require('../utils/logger');

/**
 * @route   POST /api/roles
 * @desc    Create a new role
 * @access  Private
 */
exports.createRole = async (req, res) => {
  try {
    const userId = req.user._id;

    const role = await RoleService.createRole(req.body, userId);

    res.status(201).json({ message: 'Role created successfully', role });
  } catch (error) {
    const userId = req.user?._id;

    logger.error('Error in createRole controller', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      createdBy: userId,
    });

    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Server error' : error.message;
    res.status(statusCode).json({ message });
  }
};

/**
 * @route   GET /api/roles
 * @desc    Get all roles
 * @access  Private
 */
exports.getRoles = async (req, res) => {
  try {
    const roles = await RoleService.getAllRoles();

    res.status(200).json({ roles });
  } catch (error) {
    logger.error('Error in getRoles controller', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   GET /api/roles/search
 * @desc    Search roles with pagination
 * @access  Private
 */
exports.searchRoles = async (req, res) => {
  try {
    const { keyword = '', page = 1, limit = 10 } = req.query;
    
    const result = await RoleService.searchRoles({
      keyword,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in searchRoles controller', {
      error: error.message,
      query: req.query,
      stack: error.stack
    });
    
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Server error' : error.message;
    res.status(statusCode).json({ message });
  }
};

/**
 * @route   GET /api/roles/:id
 * @desc    Get role by ID
 * @access  Private
 */
exports.getRoleById = async (req, res) => {
  try {
    const role = await RoleService.getRoleById(req.params.id);
    res.status(200).json({ role });
  } catch (error) {
    logger.error('Error in getRoleById controller', {
      error: error.message,
      roleId: req.params.id,
      stack: error.stack
    });
    
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Server error' : error.message;
    res.status(statusCode).json({ message });
  }
};

/**
 * @route   PUT /api/roles/:id
 * @desc    Update a role
 * @access  Private
 */
exports.updateRole = async (req, res) => {
  try {
    const role = await RoleService.updateRole(req.params.id, req.body);
    res.status(200).json(role);
  } catch (error) {
    logger.error('Error in updateRole controller', {
      error: error.message,
      roleId: req.params.id,
      updateData: req.body,
      stack: error.stack
    });
    
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Server error' : error.message;
    res.status(statusCode).json({ message });
  }
};

/**
 * @route   DELETE /api/roles/:id
 * @desc    Delete a role
 * @access  Private
 */
exports.deleteRole = async (req, res) => {
  try {
    await RoleService.deleteRole(req.params.id);
    res.status(200).json({ message: 'Role deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteRole controller', {
      error: error.message,
      roleId: req.params.id,
      stack: error.stack
    });
    
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Server error' : error.message;
    res.status(statusCode).json({ message });
  }
};
