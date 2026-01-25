const Joi = require('joi');
const { objectId } = require('../middleware/validation');

const createUserSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required()
    .messages({
      'string.empty': 'Full name is required',
      'string.min': 'Full name must be at least 2 characters long',
      'string.max': 'Full name cannot exceed 100 characters'
    }),
  
  mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required()
    .messages({
      'string.pattern.base': 'Mobile number must be a valid 10-digit Indian number',
      'string.empty': 'Mobile number is required'
    }),
  
  
  branchId: objectId.optional()
    .messages({
      'string.pattern.base': 'Invalid branch ID format'
    }),
  
  role: objectId.optional()
    .messages({
      'string.pattern.base': 'Invalid role ID format'
    }),
  
  cargoBalance: Joi.number().min(0).default(0)
    .messages({
      'number.min': 'Cargo balance cannot be negative'
    }),
  
  status: Joi.string().valid('Active', 'Inactive').default('Active')
    .messages({
      'any.only': 'Status must be either Active or Inactive'
    })
});

const updateUserSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).optional()
    .messages({
      'string.min': 'Full name must be at least 2 characters long',
      'string.max': 'Full name cannot exceed 100 characters'
    }),
  
  mobile: Joi.string().pattern(/^[6-9]\d{9}$/).optional()
    .messages({
      'string.pattern.base': 'Mobile number must be a valid 10-digit Indian number'
    }),
  
  branchId: objectId.optional()
    .messages({
      'string.pattern.base': 'Invalid branch ID format'
    }),
  
  role: objectId.optional()
    .messages({
      'string.pattern.base': 'Invalid role ID format'
    }),
  
  cargoBalance: Joi.number().min(0).optional()
    .messages({
      'number.min': 'Cargo balance cannot be negative'
    }),
  
  status: Joi.string().valid('Active', 'Inactive').optional()
    .messages({
      'any.only': 'Status must be either Active or Inactive'
    })
});

const searchUserSchema = Joi.object({
  fullName: Joi.string().trim().optional(),
  mobile: Joi.string().pattern(/^[6-9]\d{9}$/).optional(),
  status: Joi.string().valid('Active', 'Inactive').optional(),
  branchId: objectId.optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const userIdParamSchema = Joi.object({
  id: objectId.required()
    .messages({
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'User ID is required'
    })
});

const operatorIdQuerySchema = Joi.object({
  operatorId: objectId.required()
    .messages({
      'string.pattern.base': 'Invalid operator ID format',
      'any.required': 'Operator ID is required'
    })
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  searchUserSchema,
  userIdParamSchema,
  operatorIdQuerySchema
};