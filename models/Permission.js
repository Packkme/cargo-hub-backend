const mongoose = require('mongoose');
const applyOperatorScope = require('../utils/mongooseOperatorScope');


const permissionSchema = new mongoose.Schema({
  name: { type: String, required: true },        // e.g., "create_user"
  description: { type: String },                 // e.g., "Allows creating users"
  createdAt: { type: Date, default: Date.now },
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator'}
});

permissionSchema.plugin(applyOperatorScope);

module.exports = mongoose.model('Permission', permissionSchema);
