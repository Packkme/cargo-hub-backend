const mongoose = require('mongoose');

const operatorSchema = new mongoose.Schema({
  name: { type: String, required: true },
   code: { 
    type: String, 
    required: true,
    unique: true,
    uppercase: true,     
    minlength: 3,
    maxlength: 3,
    validate: {
      validator: function(v) {
        // v is already uppercase
        const validFormat = /^[A-Z0-9]{3}$/.test(v);
        const hasLetter = /[A-Z]/.test(v);
        return validFormat && hasLetter;
      },
      message: props => `${props.value} is invalid. Code must be 3 alphanumeric uppercase chars with at least one letter.`
    }
  },
  address: { type: String },
  phone: { type: String, required: true },
  bookingSequence: { type: Number, default: 1 },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  paymentOptions: {
    type: [{
      type: String,
      enum: ['Cash', 'UPI'],
      required: true
    }],
    default: ['Cash'],
    validate: {
      validator: function(v) {
        return v.length > 0 && v.every(option => ['Cash', 'UPI'].includes(option));
      },
      message: 'Payment options must include at least one valid option: Cash or UPI'
    }
  },
  gstNumber: {
    type: String,
    match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/, 'Invalid GST number format'],
    required: false
  },
  panNumber: {
    type: String,
    match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format'],
    required: false
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now },
  bookingTemplate: { 
    type: String, 
    default: 'booking-confirmation-template.html',
    description: 'Name of the HTML template file for bookings'
  },
  whatsappConfig: {
    apiKey: { type: String },
    phoneNumber: { type: String },
    feedbackTemplateName: { type: String },
  }
});

// Correct: Capitalized model name
module.exports = mongoose.model('Operator', operatorSchema);
