const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');
const XLSX = require('xlsx');

const formatDate = (dt) => dt ? new Date(dt).toISOString().slice(0, 10) : '';
const formatTime = (dt) => dt ? new Date(dt).toTimeString().split(' ')[0] : '';
const formatDateTime = (dt) => dt ? `${formatDate(dt)} ${formatTime(dt)}` : '';
const getEventDate = (events, type) => {
  const event = Array.isArray(events) ? events.find(ev => ev.type === type) : null;
  return event?.date || '';
};

exports.getBookingReport = async (req, res) => {
  const { date, sortField = 'bookingDate', sortOrder = 'asc', page = 1, limit = 10 } = req.body;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || (!operatorId && !requestContext.isSuperUser())) return res.status(400).json({ error: 'Date and operatorId are required' });

  try {
    const filter = { bookingDate: date.trim(), operatorId, status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] } };
    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const reportData = bookings.map(b => {
      const status = b.status
        ? b.status.charAt(0).toUpperCase() + b.status.slice(1)
        : 'Unknown';

      const statusDate = b.updatedAt;

      return {
        date: b.bookingDate || '',
        bookingId: b.bookingId,
        senderName: b.senderName || '',
        senderPhone: b.senderPhone || '',
        receiverName: b.receiverName || '',
        receiverPhone: b.receiverPhone || '',
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        lrType: b.lrType || '',
        quantity: b.quantity || 0,
        freightCharge: b.freightCharge || 0,
        loadingCharge: b.loadingCharge || 0,
        unloadingCharge: b.unloadingCharge || 0,
        otherCharge: b.gst || 0,
        totalAmountCharge: b.totalAmountCharge || 0,
        status,
        statusDate: new Date(statusDate).toISOString()
      };
    });

    let totalsRow = null;
    if (Number(page) === totalPages && totalRecords > 0) {
      const all = await Booking.find(filter).lean();
      const totals = all.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.loadingCharge += r.loadingCharge || 0;
        acc.unloadingCharge += r.unloadingCharge || 0;
        acc.otherCharge += r.gst || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        return acc;
      }, { quantity: 0, freightCharge: 0, loadingCharge: 0, unloadingCharge: 0, otherCharge: 0, totalAmountCharge: 0 });
      totalsRow = {
        blankDate: '', blankBookingId: '', blankSenderName: '',
        blankSenderPhone: '', blankReceiverName: '', blankReceiverPhone: '',
        blankFromOffice: '', blankToOffice: '', blankLrType: 'TOTAL',
        blankQuantity: totals.quantity,
        blankFreightCharge: totals.freightCharge,
        blankLoadingCharge: totals.loadingCharge,
        blankUnloadingCharge: totals.unloadingCharge,
        blankOtherCharge: totals.otherCharge,
        blankTotalAmountCharge: totals.totalAmountCharge,
        blankStatus: ''
      };
    }

    res.json({ date, sortBy: sortField, sortOrder, page: Number(page), limit: Number(limit), totalRecords, totalPages, report: reportData, ...(totalsRow && { totalsRow }) });
  } catch (error) {
    logger.error('Error booking report', { error: error.message, userId: userId?.toString(), operatorId: operatorId?.toString() });
    res.status(500).json({ error: 'Failed to generate booking report' });
  }
};

exports.getDelivaryReport = async (req, res) => {
  const { date, sortField = 'bookingDate', sortOrder = 'asc', page = 1, limit = 10 } = req.body;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || (!operatorId && !requestContext.isSuperUser())) return res.status(400).json({ error: 'Date and operatorId are required' });

  try {
    const filter = { arrivalDate: date, operatorId, status: 'Delivered' };
    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const formattedDate = date.split('-').reverse().join('/');
    const reportData = bookings.map(b => {
      const unloadEv = (b.eventHistory || []).find(e => e.type === 'unloaded');
      const deliverEv = (b.eventHistory || []).find(e => e.type === 'delivered');
      return {
        date: formattedDate,
        bookingId: b.bookingId,
        senderName: b.senderName || '',
        senderPhone: b.senderPhone || '',
        receiverName: b.receiverName || '',
        receiverPhone: b.receiverPhone || '',
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        lrType: b.lrType || '',
        deliveryType: 'Self',
        vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        unloadingDate: unloadEv ? unloadEv.date : '',
        quantity: b.quantity || 0,
        totalAmountCharge: b.totalAmountCharge || 0,
        freightCharge: b.freightCharge || 0,
        loadingCharge: b.loadingCharge || 0,
        unloadingCharge: b.unloadingCharge || 0,
        otherCharge: b.gst || 0,
        bookingDate: b.bookingDate || '',
        status: b.status || ''
      };
    });

    let totalsRow = null;
    if (Number(page) === totalPages && totalRecords > 0) {
      const all = await Booking.find(filter).lean();
      const totals = all.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.loadingCharge += r.loadingCharge || 0;
        acc.unloadingCharge += r.unloadingCharge || 0;
        acc.otherCharge += r.gst || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        return acc;
      }, { quantity: 0, freightCharge: 0, loadingCharge: 0, unloadingCharge: 0, otherCharge: 0, totalAmountCharge: 0 });

      totalsRow = {
        blankDate: formattedDate,
        bookingId: '',
        senderName: '',
        senderPhone: '',
        receiverName: '',
        receiverPhone: '',
        fromOffice: '',
        toOffice: '',
        lrType: '',
        deliveryType: '',
        vehicleNumber: '',
        unloadingDate: 'TOTAL',
        quantity: totals.quantity,
        totalAmountCharge: totals.totalAmountCharge,
        freightCharge: totals.freightCharge,
        loadingCharge: totals.loadingCharge,
        unloadingCharge: totals.unloadingCharge,
        otherCharge: totals.otherCharge,
        status: ''
      };
    }

    res.json({ date, sortBy: sortField, sortOrder, page: Number(page), limit: Number(limit), totalRecords, totalPages, report: reportData, ...(totalsRow && { totalsRow }) });
  } catch (error) {
    logger.error('Error delivery report', { error: error.message, userId: userId?.toString(), operatorId: operatorId?.toString() });
    res.status(500).json({ error: 'Failed to generate delivery report' });
  }
};

exports.getStatusReport = async (req, res) => {
  const { date, sortField = 'bookingId', sortOrder = 'asc', page = 1, limit = 10 } = req.body;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || (!operatorId && !requestContext.isSuperUser())) return res.status(400).json({ error: 'Date and operatorId are required' });

  try {
    const filter = { bookingDate: date, operatorId, status: { $nin: ['Cancelled', 'Pending'] } };
    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const report = bookings.map(b => {
      const unloadEv = (b.eventHistory || []).find(e => e.type === 'unloaded');
      const deliverEv = (b.eventHistory || []).find(e => e.type === 'delivered');
      const created = new Date(b.createdAt);
      return {
        bookingId: b.bookingId,
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        quantity: b.quantity || 0,
        lrType: b.lrType || '',
        status: b.status || '',
        vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        dateOfBooking: created.toISOString().slice(0, 10),
        timeOfBooking: created.toTimeString().split(' ')[0],
        unloadedDate: unloadEv ? unloadEv.date.toISOString().slice(0, 10) : '',
        unloadedTime: unloadEv ? unloadEv.date.toTimeString().split(' ')[0] : '',
        deliveredDate: deliverEv ? deliverEv.date.toISOString().slice(0, 10) : '',
        deliveredTime: deliverEv ? deliverEv.date.toTimeString().split(' ')[0] : '',
        freightCharge: b.freightCharge || 0,
        loadingCharge: b.loadingCharge || 0,
        unloadingCharge: b.unloadingCharge || 0,
        otherCharge: b.gst || 0,
        totalAmountCharge: b.totalAmountCharge || 0
      };
    });

    let totalsRow = null;
    if (Number(page) === totalPages && totalRecords > 0) {
      const all = await Booking.find(filter).lean();
      const totals = all.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.loadingCharge += r.loadingCharge || 0;
        acc.unloadingCharge += r.unloadingCharge || 0;
        acc.otherCharge += r.gst || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        return acc;
      }, { quantity: 0, freightCharge: 0, loadingCharge: 0, unloadingCharge: 0, otherCharge: 0, totalAmountCharge: 0 });

      totalsRow = {
        bookingId: '',
        fromOffice: '',
        toOffice: '',
        quantity: totals.quantity,
        lrType: 'TOTAL',
        status: '',
        vehicleNumber: '',
        dateOfBooking: '',
        timeOfBooking: '',
        unloadedDate: '',
        unloadedTime: '',
        deliveredDate: '',
        deliveredTime: '',
        freightCharge: totals.freightCharge,
        loadingCharge: totals.loadingCharge,
        unloadingCharge: totals.unloadingCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge
      };
    }

    res.json({ date, sortField, sortOrder, page: Number(page), limit: Number(limit), totalRecords, totalPages, report, ...(totalsRow && { totalsRow }) });
  } catch (error) {
    logger.error('Error status report', { error: error.message, userId: userId?.toString(), operatorId: operatorId?.toString() });
    res.status(500).json({ error: 'Failed to generate status report' });
  }
};

exports.getLoadingReport = async (req, res) => {
  const { date, sortField = 'date', sortOrder = 'asc', page = 1, limit = 10 } = req.body;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || (!operatorId && !requestContext.isSuperUser())) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      operatorId,
      bookingDate: date,
      status: 'InTransit'
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    const report = bookings.map(b => {
      const dt = getEventDate(b.eventHistory, 'loaded') || b.createdAt;
      return {
        bookingDate: b.bookingDate,
        loadingDateTime: formatDateTime(dt),
        bookingId: b.bookingId,
        vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        status: b.status,
        quantity: b.quantity || 0,
        freightCharge: b.freightCharge || 0,
        otherCharge: b.gst || 0,
        totalAmountCharge: b.totalAmountCharge || 0
      };
    }).sort((a, b) => {
      return sortOrder === 'desc'
        ? new Date(b.loadingDateTime) - new Date(a.loadingDateTime)
        : new Date(a.loadingDateTime) - new Date(b.loadingDateTime);
    }).slice(skip, skip + limit);

    let totalsRow = null;
    if (Number(page) === totalPages && totalRecords > 0) {
      const all = await Booking.find(filter).lean();
      const totals = all.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.otherCharge += r.gst || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        acc.noOfBookings += 1;
        return acc;
      }, { quantity: 0, freightCharge: 0, otherCharge: 0, totalAmountCharge: 0, noOfBookings: 0 });

      totalsRow = {
        bookingDate: '',
        loadingDateTime: '',
        bookingId: '',
        vehicleNumber: '',
        fromOffice: '',
        toOffice: '',
        status: 'TOTAL',
        noOfBookings: totals.noOfBookings,
        quantity: totals.quantity,
        freightCharge: totals.freightCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge
      };
    }

    res.json({ date, sortField, sortOrder, page, limit, totalRecords, totalPages, report, ...(totalsRow && { totalsRow }) });
  } catch (err) {
    logger.error('Error generating loading report', {
      error: err.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate loading report' });
  }
};

exports.getUnloadingReport = async (req, res) => {
  const { date, sortField = 'date', sortOrder = 'asc', page = 1, limit = 10 } = req.body;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || (!operatorId && !requestContext.isSuperUser())) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      operatorId,
      bookingDate: date,
      status: 'Arrived'
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    const report = bookings.map(b => {
      const loadedDt = getEventDate(b.eventHistory, 'loaded') || b.createdAt;
      const unloadedDt = getEventDate(b.eventHistory, 'unloaded');
      return {
        bookingDate: b.bookingDate,
        loadingDateTime: formatDateTime(loadedDt),
        unloadingDateTime: formatDateTime(unloadedDt),
        bookingId: b.bookingId,
        vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        fromOffice: b.fromOffice?.name || '',
        toOffice: b.toOffice?.name || '',
        status: b.status,
        quantity: b.quantity || 0,
        freightCharge: b.freightCharge || 0,
        otherCharge: b.gst || 0,
        totalAmountCharge: b.totalAmountCharge || 0
      };
    }).sort((a, b) => {
      return sortOrder === 'desc'
        ? new Date(b.unloadingDateTime || 0) - new Date(a.unloadingDateTime || 0)
        : new Date(a.unloadingDateTime || 0) - new Date(b.unloadingDateTime || 0);
    }).slice(skip, skip + limit);

    let totalsRow = null;
    if (Number(page) === totalPages && totalRecords > 0) {
      const all = await Booking.find(filter).lean();
      const totals = all.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.otherCharge += r.gst || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        acc.noOfBookings += 1;
        return acc;
      }, { quantity: 0, freightCharge: 0, otherCharge: 0, totalAmountCharge: 0, noOfBookings: 0 });

      totalsRow = {
        bookingDate: '',
        loadingDateTime: '',
        unloadingDateTime: '',
        bookingId: '',
        vehicleNumber: '',
        fromOffice: '',
        toOffice: '',
        status: 'TOTAL',
        noOfBookings: totals.noOfBookings,
        quantity: totals.quantity,
        freightCharge: totals.freightCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge
      };
    }

    res.json({ date, sortField, sortOrder, page, limit, totalRecords, totalPages, report, ...(totalsRow && { totalsRow }) });
  } catch (err) {
    logger.error('Error generating unloading report', {
      error: err.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate unloading report' });
  }
};

exports.getIGCLreport = async (req, res) => {
  const { date, page = 1, limit = 10 } = req.body;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || (!operatorId && !requestContext.isSuperUser())) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] },
      bookingDate: date
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const formatDate = (dt) => dt ? new Date(dt).toISOString().split('T')[0] : '';
    const formatDateTime = (dt) => dt ? new Date(dt).toISOString().replace('T', ' ').split('.')[0] : '';

    const getEventDate = (events, type) => {
      const e = Array.isArray(events) ? events.find(ev => ev.type === type) : null;
      return e?.date || '';
    };

    const report = bookings.map(b => ({
      bookingDate: formatDate(b.bookingDate),
      loadingDateTime: formatDateTime(getEventDate(b.eventHistory, 'loaded') || b.loadingDate),
      bookingId: b.bookingId,
      fromOffice: b.fromOffice?.name || '',
      toOffice: b.toOffice?.name || '',
      vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
      quantity: b.quantity || 0,
      freightCharge: b.freightCharge || 0,
      loadingCharge: b.loadingCharge || 0,
      unloadingCharge: b.unloadingCharge || 0,
      otherCharge: b.gst || 0,
      totalAmountCharge: b.totalAmountCharge || 0
    }));

    let totalsRow = null;

    if (Number(page) === totalPages && totalRecords > 0) {
      const allBookings = await Booking.find(filter).lean();
      const totals = allBookings.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.loadingCharge += r.loadingCharge || 0;
        acc.unloadingCharge += r.unloadingCharge || 0;
        acc.otherCharge += r.gst || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        return acc;
      }, {
        quantity: 0,
        freightCharge: 0,
        loadingCharge: 0,
        unloadingCharge: 0,
        otherCharge: 0,
        totalAmountCharge: 0
      });

      totalsRow = {
        bookingDate: '',
        loadingDateTime: '',
        bookingId: '',
        fromOffice: '',
        toOffice: '',
        vehicleNumber: 'TOTAL',
        quantity: totals.quantity,
        freightCharge: totals.freightCharge,
        loadingCharge: totals.loadingCharge,
        unloadingCharge: totals.unloadingCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge
      };
    }

    res.json({
      date,
      page: Number(page),
      limit: Number(limit),
      totalRecords,
      totalPages,
      report,
      ...(totalsRow && { totalsRow })
    });

  } catch (error) {
    logger.error('Error generating IGCL report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate IGCL report' });
  }
};

exports.getOGCLreport = async (req, res) => {
  const { date, page = 1, limit = 10 } = req.body;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || (!operatorId && !requestContext.isSuperUser())) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] },
      bookingDate: date
    };

    const totalRecords = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const formatDate = (dt) => dt ? new Date(dt).toISOString().split('T')[0] : '';
    const formatDateTime = (dt) => dt ? new Date(dt).toISOString().replace('T', ' ').split('.')[0] : '';
    const getEventDate = (events, type) => {
      const e = Array.isArray(events) ? events.find(ev => ev.type === type) : null;
      return e?.date || '';
    };

    const report = bookings.map(b => ({
      bookingDate: formatDate(b.bookingDate),
      loadingDateTime: formatDateTime(getEventDate(b.eventHistory, 'loaded') || b.loadingDate),
      bookingId: b.bookingId,
      fromOffice: b.fromOffice?.name || '',
      toOffice: b.toOffice?.name || '',
      vehicleNumber: b.assignedVehicle?.vehicleNumber || '',
      quantity: b.quantity || 0,
      freightCharge: b.freightCharge || 0,
      loadingCharge: b.loadingCharge || 0,
      unloadingCharge: b.unloadingCharge || 0,
      otherCharge: b.gst || 0,
      totalAmountCharge: b.totalAmountCharge || 0
    }));

    let totalsRow = null;

    if (Number(page) === totalPages && totalRecords > 0) {
      const allBookings = await Booking.find(filter).lean();
      const totals = allBookings.reduce((acc, r) => {
        acc.quantity += r.quantity || 0;
        acc.freightCharge += r.freightCharge || 0;
        acc.loadingCharge += r.loadingCharge || 0;
        acc.unloadingCharge += r.unloadingCharge || 0;
        acc.otherCharge += r.gst || 0;
        acc.totalAmountCharge += r.totalAmountCharge || 0;
        return acc;
      }, {
        quantity: 0,
        freightCharge: 0,
        loadingCharge: 0,
        unloadingCharge: 0,
        otherCharge: 0,
        totalAmountCharge: 0
      });

      totalsRow = {
        bookingDate: '',
        loadingDateTime: '',
        bookingId: '',
        fromOffice: '',
        toOffice: '',
        vehicleNumber: 'TOTAL',
        quantity: totals.quantity,
        freightCharge: totals.freightCharge,
        loadingCharge: totals.loadingCharge,
        unloadingCharge: totals.unloadingCharge,
        otherCharge: totals.otherCharge,
        totalAmountCharge: totals.totalAmountCharge
      };
    }

    res.json({
      date,
      page: Number(page),
      limit: Number(limit),
      totalRecords,
      totalPages,
      report,
      ...(totalsRow && { totalsRow })
    });

  } catch (error) {
    logger.error('Error generating OGCL report', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to generate OGCL report' });
  }
};

exports.exportBookingReportExcel = async (req, res) => {
  const { date, sortField = 'bookingDate', sortOrder = 'asc' } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  try {
    const filter = {
      bookingDate: date.trim(),
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] }
    };

    const order = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: order })
      .lean();

    const formattedDate = date.split('-').reverse().join('/'); // dd/mm/yyyy

    const formatDateTime = (dt) => dt ? new Date(dt).toISOString().replace('T', ' ').split('.')[0] : '';
    const getEventDate = (events, type) => {
      const e = Array.isArray(events) ? events.find(ev => ev.type === type) : null;
      return e?.date || '';
    };

    const reportData = bookings.map(b => ({
      Date: formattedDate,
      BookingID: b.bookingId || '',
      SenderName: b.senderName || '',
      SenderPhone: b.senderPhone || '',
      ReceiverName: b.receiverName || '',
      ReceiverPhone: b.receiverPhone || '',
      FromOffice: b.fromOffice?.name || '',
      ToOffice: b.toOffice?.name || '',
      LRType: b.lrType || '',
      Quantity: b.quantity || 0,
      FreightCharge: b.freightCharge || 0,
      LoadingCharge: b.loadingCharge || 0,
      UnloadingCharge: b.unloadingCharge || 0,
      OtherCharge: b.gst || 0,
      TotalAmountCharge: b.totalAmountCharge || 0,
      LoadingDateTime: formatDateTime(getEventDate(b.eventHistory, 'loaded')),
      status: b.status
    }));

    const totals = bookings.reduce((acc, row) => {
      acc.Quantity += row.quantity || 0;
      acc.FreightCharge += row.freightCharge || 0;
      acc.LoadingCharge += row.loadingCharge || 0;
      acc.UnloadingCharge += row.unloadingCharge || 0;
      acc.OtherCharge += row.gst || 0;
      acc.TotalAmountCharge += row.totalAmountCharge || 0;
      return acc;
    }, {
      Quantity: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    reportData.push({
      Date: '',
      BookingID: '',
      SenderName: '',
      SenderPhone: '',
      ReceiverName: '',
      ReceiverPhone: '',
      FromOffice: '',
      ToOffice: '',
      LRType: 'TOTAL',
      Quantity: totals.Quantity,
      FreightCharge: totals.FreightCharge,
      LoadingCharge: totals.LoadingCharge,
      UnloadingCharge: totals.UnloadingCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge,
      LoadingDateTime: '',
      status: ''
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData, {
      header: [
        'Date', 'BookingID', 'SenderName', 'SenderPhone', 'ReceiverName', 'ReceiverPhone',
        'FromOffice', 'ToOffice', 'LRType', 'Quantity', 'FreightCharge',
        'LoadingCharge', 'UnloadingCharge', 'OtherCharge', 'TotalAmountCharge',
        'LoadingDateTime', 'status'
      ]
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Booking Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    const safeDate = date.replace(/[^\w\-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename=booking_report_${safeDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting booking report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export booking report' });
  }
};

exports.exportDelivaryReportExcel = async (req, res) => {
  const { date, sortField = 'bookingDate', sortOrder = 'asc' } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  try {
    const filter = {
      arrivalDate: date,
      operatorId,
      status: 'Delivered'
    };

    const order = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: order })
      .lean();

    const formattedDate = date.split('-').reverse().join('/'); // dd/mm/yyyy
    const formatDateTime = (dt) => dt ? new Date(dt).toISOString().replace('T', ' ').split('.')[0] : '';
    const getEventDate = (events, type) => {
      const e = Array.isArray(events) ? events.find(ev => ev.type === type) : null;
      return e?.date || '';
    };

    const reportData = bookings.map(b => ({
      Date: formattedDate,
      BookingID: b.bookingId,
      SenderName: b.senderName || '',
      SenderPhone: b.senderPhone || '',
      ReceiverName: b.receiverName || '',
      ReceiverPhone: b.receiverPhone || '',
      FromOffice: b.fromOffice?.name || '',
      ToOffice: b.toOffice?.name || '',
      LRType: b.lrType || '',
      DeliveryType: 'Self',
      VehicleNumber: b.assignedVehicle?.vehicleNumber || '',
      Unloading: formatDateTime(getEventDate(b.eventHistory, 'unloaded')),
      Quantity: b.quantity || 0,
      FreightCharge: b.freightCharge || 0,
      LoadingCharge: b.loadingCharge || 0,
      UnloadingCharge: b.unloadingCharge || 0,
      OtherCharge: b.gst || 0,
      TotalAmountCharge: b.totalAmountCharge || 0,
      status: b.status
    }));

    const totals = bookings.reduce((acc, row) => {
      acc.Quantity += row.quantity || 0;
      acc.TotalAmountCharge += row.totalAmountCharge || 0;
      acc.FreightCharge += row.freightCharge || 0;
      acc.LoadingCharge += row.loadingCharge || 0;
      acc.UnloadingCharge += row.unloadingCharge || 0;
      acc.OtherCharge += row.gst || 0;
      return acc;
    }, {
      Quantity: 0,
      TotalAmountCharge: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0
    });

    reportData.push({
      Date: '',
      BookingID: '',
      SenderName: '',
      SenderPhone: '',
      ReceiverName: '',
      ReceiverPhone: '',
      FromOffice: '',
      ToOffice: '',
      LRType: '',
      DeliveryType: '',
      VehicleNumber: '',
      Unloading: 'TOTAL',
      Quantity: totals.Quantity,
      FreightCharge: totals.FreightCharge,
      LoadingCharge: totals.LoadingCharge,
      UnloadingCharge: totals.UnloadingCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge,
      status: ''
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Delivery Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=delivery_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting delivery report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export booking report' });
  }
};

exports.exportStatusReportExcel = async (req, res) => {
  const { date, sortField = 'bookingId', sortOrder = 'asc' } = req.query;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  try {
    const filter = {
      bookingDate: date,
      operatorId,
      status: { $nin: ['Cancelled', 'Pending'] }
    };

    const order = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .sort({ [sortField]: order })
      .lean();

    const reportData = bookings.map(b => {
      const unloadedAt = getEventDate(b.eventHistory, 'loaded');
      const deliveredAt = getEventDate(b.eventHistory, 'unloaded');

      return {
        BookingID: b.bookingId,
        FromOffice: b.fromOffice?.name || '',
        ToOffice: b.toOffice?.name || '',
        Quantity: b.quantity || 0,
        LRType: b.lrType || '',
        Status: b.status || '',
        VehicleNumber: b.assignedVehicle?.vehicleNumber || '',

        DateOfBooking: formatDate(b.createdAt),
        TimeOfBooking: formatTime(b.createdAt),

        UnloadedDate: formatDate(unloadedAt),
        UnloadedTime: formatTime(unloadedAt),

        DeliveredDate: formatDate(deliveredAt),
        DeliveredTime: formatTime(deliveredAt),

        FreightCharge: b.freightCharge || 0,
        LoadingCharge: b.loadingCharge || 0,
        UnloadingCharge: b.unloadingCharge || 0,
        OtherCharge: b.gst || 0,
        TotalAmountCharge: b.totalAmountCharge || 0,
        status: b.status
      };
    });

    const totals = bookings.reduce((acc, r) => {
      acc.Quantity += r.quantity || 0;
      acc.FreightCharge += r.freightCharge || 0;
      acc.LoadingCharge += r.loadingCharge || 0;
      acc.UnloadingCharge += r.unloadingCharge || 0;
      acc.OtherCharge += r.gst || 0;
      acc.TotalAmountCharge += r.totalAmountCharge || 0;
      return acc;
    }, {
      Quantity: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    reportData.push({
      BookingID: '',
      FromOffice: '',
      ToOffice: '',
      Quantity: totals.Quantity,
      LRType: 'TOTAL',
      Status: '',
      VehicleNumber: '',
      DateOfBooking: '',
      TimeOfBooking: '',
      UnloadedDate: '',
      UnloadedTime: '',
      DeliveredDate: '',
      DeliveredTime: '',
      FreightCharge: totals.FreightCharge,
      LoadingCharge: totals.LoadingCharge,
      UnloadingCharge: totals.UnloadingCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge,
      status: ''
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Status Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=status_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting status report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export status report' });
  }
};

exports.exportLoadingReportExcel = async (req, res) => {
  const { date, sortField = 'LoadingDateTime', sortOrder = 'asc' } = req.query;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || (!operatorId && !requestContext.isSuperUser())) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      bookingDate: date,
      operatorId,
      status: 'InTransit'
    };

    const order = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    // Map and add loading date
    const reportData = bookings.map(b => {
      const loadedAt = getEventDate(b.eventHistory, 'loaded') || b.createdAt;
      const loadingDate = loadedAt ? new Date(loadedAt).toISOString() : '';

      return {
        BookingDate: b.bookingDate,
        LoadingDateTime: loadingDate,
        BookingId: b.bookingId,
        VehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        FromOffice: b.fromOffice?.name || '',
        ToOffice: b.toOffice?.name || '',
        Status: b.status,
        NoOfBookings: 1,
        Quantity: b.quantity || 0,
        FreightCharge: b.freightCharge || 0,
        OtherCharge: b.gst || 0,
        TotalAmountCharge: b.totalAmountCharge || 0
      };
    });

    // Sort here, because sortField in DB might not exist (e.g., LoadingDateTime is derived)
    reportData.sort((a, b) => {
      if (sortField === 'LoadingDateTime') {
        const dateA = new Date(a.LoadingDateTime || 0);
        const dateB = new Date(b.LoadingDateTime || 0);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      }
      return 0; // fallback no sort
    });

    const totals = bookings.reduce((acc, b) => {
      acc.NoOfBookings += 1;
      acc.Quantity += b.quantity || 0;
      acc.FreightCharge += b.freightCharge || 0;
      acc.OtherCharge += b.gst || 0;
      acc.TotalAmountCharge += b.totalAmountCharge || 0;
      return acc;
    }, {
      NoOfBookings: 0,
      Quantity: 0,
      FreightCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    reportData.push({
      BookingDate: '',
      LoadingDateTime: '',
      BookingId: '',
      VehicleNumber: '',
      FromOffice: '',
      ToOffice: '',
      Status: 'TOTAL',
      NoOfBookings: totals.NoOfBookings,
      Quantity: totals.Quantity,
      FreightCharge: totals.FreightCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Loading Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=loading_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting loading report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export loading report' });
  }
};

exports.exportUnloadingReportExcel = async (req, res) => {
  const { date, sortField = 'UnloadingDateTime', sortOrder = 'asc' } = req.query;

  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  if (!date || (!operatorId && !requestContext.isSuperUser())) {
    return res.status(400).json({ error: 'Date and operatorId are required' });
  }

  try {
    const filter = {
      bookingDate: date,
      operatorId,
      status: 'Arrived'
    };

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    if (!bookings.length) {
      return res.status(404).json({ error: 'No unloading bookings found for the given date' });
    }

    const reportData = bookings.map(b => {
      const loadingTime = getEventDate(b.eventHistory, 'loaded') || b.createdAt;
      const unloadingTime = getEventDate(b.eventHistory, 'unloaded') || '';

      return {
        BookingDate: b.bookingDate || '',
        LoadingDateTime: loadingTime ? new Date(loadingTime).toISOString() : '',
        UnloadingDateTime: unloadingTime ? new Date(unloadingTime).toISOString() : '',
        BookingId: b.bookingId || '',
        VehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        FromOffice: b.fromOffice?.name || '',
        ToOffice: b.toOffice?.name || '',
        Status: b.status || '',
        NoOfBookings: 1,
        Quantity: b.quantity || 0,
        FreightCharge: b.freightCharge || 0,
        OtherCharge: b.gst || 0,
        TotalAmountCharge: b.totalAmountCharge || 0
      };
    });

    reportData.sort((a, b) => {
      if (sortField === 'UnloadingDateTime') {
        const dateA = new Date(a.UnloadingDateTime || 0);
        const dateB = new Date(b.UnloadingDateTime || 0);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      }
      return 0;
    });

    const totals = bookings.reduce((acc, b) => {
      acc.NoOfBookings += 1;
      acc.Quantity += b.quantity || 0;
      acc.FreightCharge += b.freightCharge || 0;
      acc.OtherCharge += b.gst || 0;
      acc.TotalAmountCharge += b.totalAmountCharge || 0;
      return acc;
    }, {
      NoOfBookings: 0,
      Quantity: 0,
      FreightCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    reportData.push({
      BookingDate: '',
      LoadingDateTime: '',
      UnloadingDateTime: '',
      BookingId: '',
      VehicleNumber: '',
      FromOffice: '',
      ToOffice: '',
      Status: 'TOTAL',
      NoOfBookings: totals.NoOfBookings,
      Quantity: totals.Quantity,
      FreightCharge: totals.FreightCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Unloading Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=unloading_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting unloading report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export unloading report' });
  }
};

exports.exportIGCLReportExcel = async (req, res) => {
  const { date } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  try {
    const filter = {
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] },
      bookingDate: date
    };

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    const formatDate = (dt) => dt ? new Date(dt).toISOString().split('T')[0] : '';
    const formatDateTime = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0]}`;
    };

    const report = bookings.map(b => {
      const loadingDateTime = getEventDate(b.eventHistory, 'loaded') || b.loadingDate || b.createdAt;

      return {
        BookingDate: formatDate(b.bookingDate),
        LoadingDateTime: formatDateTime(loadingDateTime),
        BookingId: b.bookingId || '',
        FromOffice: b.fromOffice?.name || '',
        ToOffice: b.toOffice?.name || '',
        VehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        Quantity: b.quantity || 0,
        FreightCharge: b.freightCharge || 0,
        LoadingCharge: b.loadingCharge || 0,
        UnloadingCharge: b.unloadingCharge || 0,
        OtherCharge: b.gst || 0,
        TotalAmountCharge: b.totalAmountCharge || 0,
        status: b.status
      };
    });

    const totals = bookings.reduce((acc, r) => {
      acc.Quantity += r.quantity || 0;
      acc.FreightCharge += r.freightCharge || 0;
      acc.LoadingCharge += r.loadingCharge || 0;
      acc.UnloadingCharge += r.unloadingCharge || 0;
      acc.OtherCharge += r.gst || 0;
      acc.TotalAmountCharge += r.totalAmountCharge || 0;
      return acc;
    }, {
      Quantity: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    report.push({
      BookingDate: '',
      LoadingDateTime: '',
      BookingId: '',
      FromOffice: '',
      ToOffice: '',
      VehicleNumber: 'TOTAL',
      status: '',
      ...totals
    });

    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IGCL Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=igcl_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting IGCL report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export IGCL report' });
  }
};

exports.exportOGCLReportExcel = async (req, res) => {
  const { date } = req.query;
  const operatorId = requestContext.getOperatorId();
  const userId = req.user?._id;

  try {
    const filter = {
      operatorId,
      status: { $in: ['Booked', 'InTransit', 'Arrived', 'Delivered'] },
      bookingDate: date
    };

    const bookings = await Booking.find(filter)
      .populate('fromOffice', 'name')
      .populate('toOffice', 'name')
      .populate('assignedVehicle', 'vehicleNumber')
      .lean();

    const getEventDate = (events, type) => {
      const e = Array.isArray(events) ? events.find(ev => ev.type === type) : null;
      return e?.date || '';
    };

    const formatDate = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return d.toISOString().split('T')[0];
    };

    const formatDateTime = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      return `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0]}`;
    };

    const report = bookings.map(b => {
      const loadingDateTime = getEventDate(b.eventHistory, 'loaded') || b.loadingDateTime || b.loadingDate || b.createdAt;

      return {
        BookingDate: formatDate(b.bookingDate),
        LoadingDateTime: formatDateTime(loadingDateTime),
        BookingId: b.bookingId || '',
        FromOffice: b.fromOffice?.name || '',
        ToOffice: b.toOffice?.name || '',
        VehicleNumber: b.assignedVehicle?.vehicleNumber || '',
        Quantity: b.quantity || 0,
        FreightCharge: b.freightCharge || 0,
        LoadingCharge: b.loadingCharge || 0,
        UnloadingCharge: b.unloadingCharge || 0,
        OtherCharge: b.gst || 0,
        TotalAmountCharge: b.totalAmountCharge || 0,
        status: b.status || ''
      };
    });

    // Totals
    const totals = bookings.reduce((acc, r) => {
      acc.Quantity += r.quantity || 0;
      acc.FreightCharge += r.freightCharge || 0;
      acc.LoadingCharge += r.loadingCharge || 0;
      acc.UnloadingCharge += r.unloadingCharge || 0;
      acc.OtherCharge += r.gst || 0;
      acc.TotalAmountCharge += r.totalAmountCharge || 0;
      return acc;
    }, {
      Quantity: 0,
      FreightCharge: 0,
      LoadingCharge: 0,
      UnloadingCharge: 0,
      OtherCharge: 0,
      TotalAmountCharge: 0
    });

    // Add total row
    report.push({
      BookingDate: '',
      LoadingDateTime: '',
      BookingId: '',
      FromOffice: '',
      ToOffice: '',
      VehicleNumber: 'TOTAL',
      Quantity: totals.Quantity,
      FreightCharge: totals.FreightCharge,
      LoadingCharge: totals.LoadingCharge,
      UnloadingCharge: totals.UnloadingCharge,
      OtherCharge: totals.OtherCharge,
      TotalAmountCharge: totals.TotalAmountCharge,
      status: ''
    });

    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'OGCL Report');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=ogcl_report_${date}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Error exporting OGCL report to Excel', {
      error: error.message,
      userId: userId?.toString(),
      operatorId: operatorId?.toString()
    });
    res.status(500).json({ error: 'Failed to export OGCL report' });
  }
};