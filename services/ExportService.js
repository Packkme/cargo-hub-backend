const XLSX = require('xlsx');
const BookingService = require('./BookingService');

const flattenBookings = (bookings) =>
  bookings.map((b) => ({
    BookingID: b.bookingId,
    Status: b.status,
    BookingDate: b.bookingDate,
    LRType: b.lrType,
    FromOffice: b.fromOffice?.name || '',
    ToOffice: b.toOffice?.name || '',
    SenderName: b.senderName,
    SenderPhone: b.senderPhone,
    SenderAddress: b.senderAddress,
    ReceiverName: b.receiverName,
    ReceiverPhone: b.receiverPhone,
    ReceiverAddress: b.receiverAddress,
    Weight: b.weight,
    Quantity: b.quantity,
    ValueOfGoods: b.valueOfGoods,
    FreightCharge: b.freightCharge,
    TotalAmount: b.totalAmountCharge,
    AssignedVehicle: b.assignedVehicle?.vehicleNumber || '',
    DispatchDate: b.dispatchDate,
    ArrivalDate: b.arrivalDate,
    CreatedAt: b.createdAt,
  }));

const generateXLSXBuffer = (data, sheetName = 'Sheet1') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const exportBookings = async (operatorId) => {
  const { bookings } = await BookingService.getAllBookings(operatorId);
  const flattened = flattenBookings(bookings);
  return generateXLSXBuffer(flattened, 'All Bookings');
};

const exportUnassignedBookings = async (operatorId, query = '') => {
  const { bookings } = await BookingService.getUnassignedBookings(operatorId, 1, 10000, query);
  if (!bookings.length) throw new Error('No unassigned bookings found to export');

  const flattened = bookings.map(b => ({
    BookingID: b.bookingId,
    SenderName: b.senderName,
    ReceiverName: b.receiverName,
    BookedBy: b.bookedBy?.fullName || '',
    FromOffice: b.fromOffice?.name || '',
    ToOffice: b.toOffice?.name || '',
    CreatedAt: b.createdAt,
  }));

  return generateXLSXBuffer(flattened, 'Unassigned Bookings');
};

const exportArrivedBookings = async (operatorId, query = '') => {
  const { bookings } = await BookingService.getArrivedBookings(operatorId, 1, 10000, query);
  if (!bookings.length) throw new Error('No arrived bookings found to export');

  const flattened = bookings.map(b => ({
    BookingID: b.bookingId,
    SenderName: b.senderName,
    ReceiverName: b.receiverName,
    FromOffice: b.fromOffice?.name || '',
    ToOffice: b.toOffice?.name || '',
    ArrivalDate: b.arrivalDate,
    CreatedAt: b.createdAt,
  }));

  return generateXLSXBuffer(flattened, 'Arrived Bookings');
};

const exportInTransitBookings = async (operatorId, query = '') => {
  const { bookings } = await BookingService.getInTransitBookings(operatorId, 1, 10000, query);
  if (!bookings.length) throw new Error('No in-transit bookings found to export');

  const flattened = bookings.map(b => ({
    BookingID: b.bookingId,
    SenderName: b.senderName,
    ReceiverName: b.receiverName,
    FromOffice: b.fromOffice?.name || '',
    ToOffice: b.toOffice?.name || '',
    DispatchDate: b.dispatchDate,
    CreatedAt: b.createdAt,
  }));

  return generateXLSXBuffer(flattened, 'In Transit Bookings');
};

module.exports = {
  exportBookings,
  exportUnassignedBookings,
  exportArrivedBookings,
  exportInTransitBookings
};
