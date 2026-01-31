const mongoose = require('mongoose');
const applyOperatorScope = require('../utils/mongooseOperatorScope');

const cashTransferSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    description: { type: String },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now},
    createdAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator', required: true }
});

cashTransferSchema.plugin(applyOperatorScope);

module.exports = mongoose.model('CashTransfer', cashTransferSchema);