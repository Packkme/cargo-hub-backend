const Operator = require('../models/Operator');
logger = require('../utils/logger');

class OperatorService {
  static async createOperator(operatorData) {
    if (operatorData.code) {
      operatorData.code = operatorData.code.toUpperCase();
    }
    if (operatorData.loadingChargePerUnit !== undefined) {
      const parsed = Number(operatorData.loadingChargePerUnit);
      if (Number.isFinite(parsed)) {
        operatorData.loadingChargePerUnit = parsed;
      } else {
        delete operatorData.loadingChargePerUnit;
      }
    }
    if (operatorData.gstRate !== undefined) {
      const parsed = Number(operatorData.gstRate);
      if (Number.isFinite(parsed)) {
        operatorData.gstRate = parsed;
      } else {
        delete operatorData.gstRate;
      }
    }

    if (!/^[A-Z0-9]{3}$/.test(operatorData.code)) {
      throw new Error('Code must be exactly 3 characters, containing only uppercase letters and numbers.');
    }
    if (!/[A-Z]/.test(operatorData.code)) {
      throw new Error('Code must contain at least one uppercase letter.');
    }

    // Check if operator with same code exists
    const existingCode = await Operator.findOne({ code: operatorData.code });
    if (existingCode) {
      throw new Error('Code already exists, try a different code');
    }

    // Check if operator with same name exists
    const existingName = await Operator.findOne({ name: operatorData.name });
    if (existingName) {
      throw new Error('Operator with this name already exists');
    }

      // Check if operator with same name exists
      const existingTemplateName = await Operator.findOne({ name: operatorData.bookingTemplate });
      if (existingTemplateName) {
          throw new Error('Operator with this template name already exists');
      }

    if (operatorData.whatsappConfig?.phoneNumber) {
      const existingPhoneNumber = await Operator.findOne({ 'whatsappConfig.phoneNumber': operatorData.whatsappConfig.phoneNumber });
      if (existingPhoneNumber) {
        throw new Error(`WhatsApp phone number ${operatorData.whatsappConfig.phoneNumber} is already in use by another operator`);
      }
    }

    const operator = new Operator(operatorData);
    await operator.save();
    return operator;
  }

    static async getAllOperators() {
        return await Operator.find();
    }

     /**
     * Update operator by ID
     * @param {String} operatorId - Operator's MongoDB ObjectId
     * @param {Object} updateData - Fields to update
     * @returns {Object|null}
     */
    static async updateOperator(operatorId, updateData) {
        try {
          if (updateData.loadingChargePerUnit !== undefined) {
            const parsed = Number(updateData.loadingChargePerUnit);
            if (Number.isFinite(parsed)) {
              updateData.loadingChargePerUnit = parsed;
            } else {
              delete updateData.loadingChargePerUnit;
            }
          }
          if (updateData.gstRate !== undefined) {
            const parsed = Number(updateData.gstRate);
            if (Number.isFinite(parsed)) {
              updateData.gstRate = parsed;
            } else {
              delete updateData.gstRate;
            }
          }
          updateData.updatedAt = new Date();
          if (updateData.whatsappConfig?.phoneNumber) {
            const existingPhoneNumber = await Operator.findOne({
              'whatsappConfig.phoneNumber': updateData.whatsappConfig.phoneNumber,
              _id: { $ne: operatorId }
            });
            if (existingPhoneNumber) {
              throw new Error(`WhatsApp phone number ${updateData.whatsappConfig.phoneNumber} is already in use by another operator`);
            }
          }
            const updatedOperator = await Operator.findByIdAndUpdate(
                operatorId,
                { $set: updateData },
                { new: true, runValidators: true, context: 'query' }
            );

            if (!updatedOperator) {
                logger.warn(`Operator not found: ${operatorId}`);
                return null;
            }

            return updatedOperator;
        } catch (error) {
            logger.error(`Error updating operator: ${error.message}`);
            throw error;
        }
    }

    /**
 * Delete operator by ID
 * @param {String} operatorId - Operator's MongoDB ObjectId
 * @returns {Object|null}
 */
static async deleteOperator(operatorId) {
    try {
        const deletedOperator = await Operator.findByIdAndDelete(operatorId);

        if (!deletedOperator) {
            logger.warn(`Operator not found for deletion: ${operatorId}`);
            return null;
        }

        logger.info(`Operator deleted: ${deletedOperator._id}`);
        return deletedOperator;
    } catch (error) {
        logger.error(`Error deleting operator: ${error.message}`);
        throw new Error('Failed to delete operator');
    }
}

    static async searchOperators(query = "", page = 1, limit = 10) {
        const regex = new RegExp(query, "i");
        const skip = (page - 1) * limit;

        const total = await Operator.countDocuments({ name: regex });
        const operators = await Operator.find({ name: regex })
            .skip(skip)
            .limit(Number(limit));

        return {
            data: operators,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
        };
    }

 /**
   * Get payment options for a specific operator
   * @param {string} operatorId
   * @returns {Promise<Array>} paymentOptions
   */
  static async getPaymentOptions(operatorId) {
    try {
      logger.info('Fetching payment options', { operatorId });

      const operator = await Operator.findById(operatorId);
      if (!operator) {
        logger.warn('Operator not found for payment options', { operatorId });
        return null;
      }

      return {
        paymentOptions: operator.paymentOptions || [],
        loadingChargePerUnit: operator.loadingChargePerUnit,
        gstRate: operator.gstRate,
      };
    } catch (error) {
      logger.error('Failed to fetch payment options', {
        error: error.message,
        operatorId,
        stack: error.stack
      });
      throw new Error('Unable to fetch payment options');
    }
  }
}


module.exports = OperatorService;
