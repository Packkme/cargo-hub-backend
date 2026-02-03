const mongoose = require("mongoose");
const applyOperatorScope = require("../utils/mongooseOperatorScope");

const VehicleSchema = new mongoose.Schema({
  vehicleNumber: { type: String, required: true, unique: true },
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator', required: true },
  status: { type: Boolean, default: true },
}, { timestamps: true });

VehicleSchema.plugin(applyOperatorScope);

module.exports = mongoose.model("Vehicle", VehicleSchema);
