const mongoose = require('mongoose');
const applyOperatorScope = require('../utils/mongooseOperatorScope');

const userSchema = new mongoose.Schema({
  //orgId
  fullName: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  token: { type: String },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  cargoBalance: { type: Number, default: 0 },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
},
{timestamps: true});

userSchema.plugin(applyOperatorScope);

module.exports = mongoose.model('User', userSchema);
  