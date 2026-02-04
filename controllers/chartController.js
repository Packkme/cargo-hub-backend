const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const requestContext = require('../utils/requestContext');
const mongoose = require('mongoose');
const chartService = require('../services/chartService');

// Get today's bookings segregated by payment type (ToPay/Paid)
exports.getTodayBookingsByPayment = async (req, res) => {
    try {
        const { date } = req.query;
        const data = await chartService.getTodayBookingsByPayment({ date });
        res.json({
            success: true,
            data
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            error: error.message
        });
    }
};

// Get ToPay and Paid bookings across all branches
exports.getBookingsByBranchAndPayment = async (req, res) => {
    try {
        const { date } = req.query;
        const data = await chartService.getBookingsByBranchAndPayment({ date });
        res.json({
            success: true,
            data
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            error: error.message
        });
    }
};

// Get bookings for last 6 months grouped by month and payment type
exports.getSixMonthBookings = async (req, res) => {
    try {
        const requestedMonth = req.query.month;
        const data = await chartService.getSixMonthBookings(requestedMonth);
        res.json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get pending bookings by branch location, categorized by payment type (Paid/ToPay)
exports.getPendingBookingsByBranch = async (req, res) => {
    try {
        const data = await chartService.getPendingBookingsByBranch();
        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error in getPendingDeliveriesByOffice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending deliveries by office',
            error: error.message
        });
    }
};
// Branch-level booking totals with filters
exports.getBookingTotalsByBranch = async (req, res) => {
    try {
        const { date } = req.query;
        const data = await chartService.getBookingTotalsByBranch({ date });
        res.json({ success: true, data });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

// Branch-to-branch booking totals for a source branch
exports.getBookingTotalsByBranchDestination = async (req, res) => {
    try {
        const { fromBranchId, date } = req.query;
        const data = await chartService.getBookingTotalsByBranchDestination({ fromBranchId, date });
        res.json({ success: true, data });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

// User-level booking totals tile
exports.getBookingTotalsByUser = async (req, res) => {
    try {
        const { userName, bookingType, date } = req.query;
        const data = await chartService.getBookingTotalsByUser({ userName, bookingType, date });
        res.json({ success: true, data });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

// User-to-branch booking totals for a source user
exports.getBookingTotalsByUserDestination = async (req, res) => {
    try {
        const { fromUserId, date } = req.query;
        const data = await chartService.getBookingTotalsByUserDestination({ fromUserId, date });
        res.json({ success: true, data });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};
