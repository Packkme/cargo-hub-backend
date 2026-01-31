const { log } = require('winston');
const BookingService = require('../services/BookingService');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');
const { Parser } = require('json2csv');
const ExportService = require('../services/ExportService');
const generatePdfBuffer = require('../utils/bookingTemplate');

// Create booking
exports.initiateBooking = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }
    const booking = await BookingService.initiateBooking(req.body, req.user._id, operatorId);
    res.status(201).json(booking);
  } catch (error) {
    logger.error('Error creating booking in controller', { error: error.message });
    res.status(400).json({ error: error.message });
  }
};

exports.collectPayment = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const bookingId = req.params.bookingId;
    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    //  Get Mongoose document
    const booking = await BookingService.getBookingById(bookingId, operatorId, true);

    //  Apply update from frontend
    await BookingService.collectPayment(booking, req.user._id, req.body);

    res.status(200).json({ message: 'Payment collected successfully' });
  } catch (error) {
    logger.error('Error in bookingController.collectPayment', { error: error.message });
    res.status(500).json({ error: 'Failed to collect payment' });
  }
};

/**
 * Get all bookings
 * @returns {Promise<Object>} JSON object with bookings and stats
 */
exports.getAllBookings = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const result = await BookingService.getAllBookings(operatorId);
    res.json(result);
  } catch (error) {
    logger.error('Error getting all bookings in controller', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }
    const booking = await BookingService.getBookingById(req.params.id, operatorId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    if (error.message === 'Booking not found') {
      return res.status(404).json({ error: error.message });
    }
    logger.error(`Error getting booking by id in controller: ${req.params.id}`, { error: error.message });
    res.status(400).json({ error: error.message });
  }
};

// Update booking by ID
exports.updateBooking = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    const userId = req.user._id;
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }
    const booking = await BookingService.updateBooking(
      req.params.id, 
      req.body,
      operatorId,
      userId
    );
    res.json(booking);
  } catch (error) {
    if (error.message === 'Booking not found') {
      return res.status(404).json({ error: error.message });
    }
    logger.error(`Error updating booking in controller: ${req.params.id}`, { error: error.message });
    res.status(400).json({ error: error.message });
  }
};

// Assign booking to vehicle
exports.multipleBookingsChange = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    const userId = req.user._id;
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const result = await BookingService.multipleBookings(req.body, operatorId, userId);
    res.json(result);
  } catch (error) {
    console.log(error);
    if (error.message === 'Booking not found') {
      return res.status(404).json({ error: error.message });
    }
    logger.error(`Error assigning booking to vehicle in controller: ${req.params.id}`, { error: error.message });
    res.status(400).json({ error: error.message });
  }
};

// Delete booking by ID
exports.deleteBooking = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }
    const result = await BookingService.deleteBooking(req.params.id, operatorId );
    res.json(result);
  } catch (error) {
    if (error.message === 'Booking not found') {
      return res.status(404).json({ error: error.message });
    }
    logger.error(`Error deleting booking in controller: ${req.params.id}`, { error: error.message });
    res.status(400).json({ error: error.message });
  }
};

// Get unassigned bookings with pagination
exports.getUnassignedBookings = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const { page = 1, limit = 10, query = "", branches, status = "" } = req.body;
    // If no branches specified, get the logged-in user's branch
    const branchIds = branches ? branches : [];

    const result = await BookingService.getUnassignedBookings(operatorId, page, limit, query, branchIds, status);
    res.json(result);
  } catch (error) {
    logger.error('Error getting unassigned bookings in controller', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get assigned bookings
exports.getAssignedBookings = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();

    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const { page = 1, limit = 10, query = "" } = req.body;

    const result = await BookingService.getAssignedBookings(operatorId, page, limit, query);
    res.json(result);
  } catch (error) {
    logger.error('Error getting assigned bookings in controller', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get in-transit bookings
exports.getInTransitBookings = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    const userId = req.user._id;
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const { page = 1, limit = 10, query = "", branches, status = "" } = req.body;
    const branchIds = branches ? branches : [];
    const result = await BookingService.getInTransitBookings(operatorId, userId, page, limit, query, branchIds, status);
    res.json(result);
  } catch (error) {
    logger.error('Error getting in-transit bookings in controller', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get arrived bookings
exports.getArrivedBookings = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    const userId = req.user._id;

    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const { page = 1, limit = 10, query = "", branches, status = '' } = req.body;

    const branchIds = branches ? branches : [];

    const result = await BookingService.getArrivedBookings(operatorId, userId, page, limit, query, branchIds, status);

    res.json(result);
  } catch (error) {
    logger.error('Error getting arrived bookings:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Search bookings with pagination
exports.searchBookings = async (req, res) => {
  try {
    const { limit = 10, page = 1, query = "", status = "" } = req.body;
    const operatorId = req.user?.operatorId;

    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ message: "Operator ID missing" });
    }

    const result = await BookingService.searchBookings({
      operatorId,
      limit,
      page,
      query,
      status
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('SEARCH_BOOKINGS_ERROR:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.exportBookings = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const buffer = await ExportService.exportBookings(operatorId);

    res.setHeader('Content-Disposition', `attachment; filename=bookings_${Date.now()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting bookings', { error: error.message });
    res.status(500).json({ error: 'Failed to export bookings' });
  }
};

exports.exportUnassignedBookings = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const query = req.query?.query || '';
    const buffer = await ExportService.exportUnassignedBookings(operatorId, query);

    res.setHeader('Content-Disposition', `attachment; filename=unassigned_bookings_${Date.now()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    if (error.message === 'No unassigned bookings found to export') {
      return res.status(404).json({ message: error.message });
    }

    logger.error('Error exporting unassigned bookings', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: 'Failed to export unassigned bookings' });
  }
};

exports.exportArrivedBookings = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const query = req.body?.query || '';
    const buffer = await ExportService.exportArrivedBookings(operatorId, query);

    res.setHeader('Content-Disposition', `attachment; filename=arrived_bookings_${Date.now()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    if (error.message === 'No arrived bookings found to export') {
      return res.status(404).json({ message: error.message });
    }

    logger.error('Error exporting arrived bookings', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: 'Failed to export arrived bookings' });
  }
};

exports.exportInTransitBookings = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const query = req.body?.query || '';
    const buffer = await ExportService.exportInTransitBookings(operatorId, query);

    res.setHeader('Content-Disposition', `attachment; filename=in_transit_bookings_${Date.now()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    if (error.message === 'No in transit bookings found to export') {
      return res.status(404).json({ message: error.message });
    }

    logger.error('Error exporting in transit bookings', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: 'Failed to export in transit bookings' });
  }
};

exports.markAsDelivered = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    const userId = req.user._id;
    const bookingId = req.params.bookingId;

    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    const booking = await BookingService.getBookingById(bookingId, operatorId, true);

    await BookingService.markAsDelivered(booking, userId, req.body);

    res.status(200).json({ message: 'Booking marked as delivered successfully' });
  } catch (error) {
    logger.error('Error in markAsDelivered controller', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to mark as delivered' });
  }
};

exports.getContactByPhone = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    if (!operatorId && !requestContext.isSuperUser()) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }
    
    const phone = req.params.phone;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const contact = await BookingService.getContactByPhone(operatorId, phone);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    logger.error('Error getting contact by phone', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


// Generate Booking PDF
exports.generateBookingPdf = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();
    const bookingId = req.params.bookingId;

    if (!bookingId || !operatorId) {
      return res.status(400).json({ error: 'Booking ID and Operator ID are required' });
    }

    const booking = await BookingService.getBookingById(bookingId, operatorId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const pdfBuffer = await generatePdfBuffer(booking);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="booking-${bookingId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating booking PDF', { error: error.message });
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};


