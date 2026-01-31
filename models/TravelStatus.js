const mongoose = require("mongoose");
const applyOperatorScope = require("../utils/mongooseOperatorScope");

const TravelStatusSchema = new mongoose.Schema(
  {
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Operator",
      required: true,
      index: true
    },

   
    importId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    
    tripDate: {
      type: Date,
      required: true,
      index: true
    },

    pnr: { type: String, required: true, index: true },
    route: String,
    vehicleNumber: { type: String, trim: true },
    driverName: String,
    driverMobile: String,

    status: {
      type: String,
      enum: ["Pending", "Boarded", "Cancelled", "Completed", "Arrived"],
      default: "Pending"
    },

    updatedBy: String,
    seatName: String,
    passengerName: String,
    passengerContact: String,
    bookedBy: String,
    boardingPoint: String,
    boardingTime: String
  },
  { timestamps: true }
);

TravelStatusSchema.plugin(applyOperatorScope);

module.exports = mongoose.model("TravelStatus", TravelStatusSchema);
