const mongoose = require('mongoose');
const applyOperatorScope = require('../utils/mongooseOperatorScope');

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  manager: { type: String },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdAt: { type: Date, default: Date.now },
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator'},
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

branchSchema.plugin(applyOperatorScope);

module.exports = mongoose.model('Branch', branchSchema);
