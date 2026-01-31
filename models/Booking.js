const mongoose = require('mongoose');
const applyOperatorScope = require('../utils/mongooseOperatorScope');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String },
  bookingDate: { type: String, index: true },

  bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventHistory: [{
    type: {
      type: String,
      enum: ['loaded', 'unloaded', 'delivered', 'cancelled'],
    },
    date: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }
  }],
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator', required: true },

  // Sender info
  senderName: String,
  senderPhone: { type: String, required: true },
  senderEmail: String,
  senderAddress: String,

  // Receiver info
  receiverName: String,
  receiverPhone: { type: String, required: true },
  receiverEmail: String,
  receiverAddress: String,

  // Branches
  fromOffice: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  toOffice: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

  // Dates
  dispatchDate: String,
  arrivalDate: String,
  wayBillNo: { type: String },

  // Package info
  packageDescription: String,
  weight: { type: Number, required: true },
  quantity: { type: Number, required: true },
  valueOfGoods: { type: Number, required: true },
  dimensions: String,

  // Payment info
  paymentStatus: { type: String },
  qr_payment_id: { type: String },
  qr_code_id: { type: String },
  qr_image_url: { type: String },
  qr_image_location: { type: String },

  // Vehicle assignment
  assignedVehicle: 
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null
    },
  

  // Status
  status: {
    type: String,
    enum: ['Pending','Booked', 'InTransit', 'Cancelled', 'Arrived', 'Delivered'],
    default: 'Pending',
  },

  deliveryType: {
  type: String,
  enum: ['Door Delivery'],
  default: undefined,     
  required: false,       
},


getpackage: {
  type: String,
},

  // Charges
  freightCharge: { type: Number, default: 0 },
  loadingCharge: { type: Number, default: 0 },
  unloadingCharge: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  totalAmountCharge: { type: Number, default: 0 },



  // LR Type
  lrType: {
    type: String,
    enum: ['Paid', 'ToPay'],
  },

  paymentType: {
    type: String,
    enum: ['', 'Cash', 'UPI'],
    default: ''
  },

  isCargoBalanceCredited: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

bookingSchema.plugin(applyOperatorScope);

module.exports = mongoose.model('Booking', bookingSchema);