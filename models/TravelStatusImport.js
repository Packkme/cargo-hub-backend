const mongoose = require("mongoose");

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

module.exports = mongoose.model(
  "TravelStatusImport",
  TravelStatusImportSchema
);
