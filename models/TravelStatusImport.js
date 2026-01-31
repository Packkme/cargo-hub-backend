const mongoose = require("mongoose");
const applyOperatorScope = require("../utils/mongooseOperatorScope");

const TravelStatusImportSchema = new mongoose.Schema(
  {
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Operator",
      required: true,
      index: true
    },

    fileName: String,

    
    filePath: {
      type: String,
      required: true
    },

    
    fileUrl: {
      type: String,
      required: true
    },

    tripDate: {
      type: Date,
      required: true
    },

    totalRecords: Number
  },
  { timestamps: true }
);

TravelStatusImportSchema.plugin(applyOperatorScope);

module.exports = mongoose.model(
  "TravelStatusImport",
  TravelStatusImportSchema
);
