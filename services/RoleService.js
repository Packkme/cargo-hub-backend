const Role = require('../models/Role');
const logger = require('../utils/logger');

class RoleService {
  /**
   * Create a new role
   * @param {Object} roleData - Role data including rolename, description, permissions
   * @param {string} operatorId - ID of the operator
   * @returns {Promise<Object>} Created role
   */
  static async createRole(roleData, createdBy) {
  logger.info('Creating new role', { rolename: roleData.rolename, createdBy });
  
  try {
    const { rolename, description, permissions } = roleData;

    if (!rolename || !description || !createdBy) {
      const error = new Error('Rolename, description, and createdBy are required');
      error.statusCode = 400;
      throw error;
    }

    const role = new Role({
      rolename,
      description,
      permissions: permissions || [],
      createdBy,
    });

    await role.save();

    logger.info('Role created successfully', { roleId: role._id, createdBy });
    return role;
  } catch (error) {
    logger.error('Failed to create role', {
      error: error.message,
      rolename: roleData.rolename,
      createdBy,
      stack: error.stack
    });
    throw error;
  }
}

  /**
   * Get all roles
   * @returns {Promise<Array>} List of all roles
   */
static async getAllRoles() {
  logger.info('Fetching roles');

  try {
    const roles = await Role.find({});
    logger.debug(`Fetched ${roles.length} roles`);
    return roles;
  } catch (error) {
    logger.error('Failed to fetch roles', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

  /**
   * Search roles with pagination and filtering
   * @param {string} operatorId - ID of the operator
   * @param {Object} options - Search options
   * @param {string} options.keyword - Search keyword
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @returns {Promise<Object>} Paginated roles
   */
  static async searchRoles({ keyword = '', page = 1, limit = 10 } = {}) {
    logger.info('Searching roles', { keyword, page, limit });
    
    try {
      const query = {
        $or: [
          { rolename: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ]
      };

      const [total, roles] = await Promise.all([
        Role.countDocuments(query),
        Role.find(query)
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
      ]);

      logger.debug(`Found ${roles.length} roles matching search criteria`, { total, page, limit });
      
      return {
        total,
        page: parseInt(page),
        pageSize: roles.length,
        roles
      };
    } catch (error) {
      logger.error('Failed to search roles', {
        error: error.message,
        keyword,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get role by ID
   * @param {string} roleId - ID of the role to fetch
   * @returns {Promise<Object>} Role details
   */
  static async getRoleById(roleId) {
    logger.info('Fetching role by ID', { roleId });
    
    try {
      const role = await Role.findById(roleId);
      
      if (!role) {
        const error = new Error('Role not found');
        error.statusCode = 404;
        throw error;
      }
      
      logger.debug('Successfully fetched role', { roleId });
      return role;
    } catch (error) {
      logger.error('Failed to fetch role', {
        error: error.message,
        roleId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Update a role
   * @param {string} roleId - ID of the role to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated role
   */
  static async updateRole(roleId, updateData) {
    logger.info('Updating role', { roleId, updateFields: Object.keys(updateData) });
    
    try {
      if (!updateData || Object.keys(updateData).length === 0) {
        const error = new Error('Missing or empty update data');
        error.statusCode = 400;
        throw error;
      }

      const updatedRole = await Role.findByIdAndUpdate(
        roleId,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!updatedRole) {
        const error = new Error('Role not found');
        error.statusCode = 404;
        throw error;
      }

      logger.info('Successfully updated role', { roleId });
      return updatedRole;
    } catch (error) {
      logger.error('Failed to update role', {
        error: error.message,
        roleId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Delete a role
   * @param {string} roleId - ID of the role to delete
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteRole(roleId) {
    logger.info('Deleting role', { roleId });
    
    try {
      const deletedRole = await Role.findByIdAndDelete(roleId);
      
      if (!deletedRole) {
        const error = new Error('Role not found');
        error.statusCode = 404;
        throw error;
      }
      
      logger.info('Successfully deleted role', { roleId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete role', {
        error: error.message,
        roleId,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = RoleService;
