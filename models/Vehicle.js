const mongoose = require("mongoose");
const applyOperatorScope = require("../utils/mongooseOperatorScope");

const VehicleSchema = new mongoose.Schema({
  vehicleNumber: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  capacity: { type: String, required: true },
  driver: { type: String, required: true },
  status: {
    type: String,
    enum: ["Available", "In Transit", "Maintenance"],
    default: "Available"
  },
  currentLocation: { type: String, required: true },
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator'},
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

VehicleSchema.plugin(applyOperatorScope);

module.exports = mongoose.model("Vehicle", VehicleSchema);
