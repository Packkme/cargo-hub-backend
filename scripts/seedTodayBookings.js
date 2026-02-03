// Insert sample bookings for today with Paid and ToPay mix.
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker/locale/en_IN');
const moment = require('moment');

require('dotenv').config({ path: '../.env' });
const config = process.env;

const Operator = require('../models/Operator');
const Branch = require('../models/Branch');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const BookingService = require('../services/BookingService');

const DEFAULT_BOOKINGS = 20;
const DEFAULT_PAID_RATIO = 0.5;
const DEFAULT_BRANCHES = 3;
const DEFAULT_USERS_PER_BRANCH = 2;
const DEFAULT_VEHICLES = 5;

const connectDB = async () => {
  try {
    const mongoUrl = 'mongodb://127.0.0.1:27017/cargo_hub_db';
    console.log('MongoDB URL:', mongoUrl);
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = {
    bookings: DEFAULT_BOOKINGS,
    paidRatio: DEFAULT_PAID_RATIO,
    branches: DEFAULT_BRANCHES,
    usersPerBranch: DEFAULT_USERS_PER_BRANCH,
    vehicles: DEFAULT_VEHICLES,
    operatorId: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--bookings' && args[i + 1]) {
      out.bookings = Number(args[i + 1]);
      i++;
      continue;
    }
    if (arg === '--paid-ratio' && args[i + 1]) {
      out.paidRatio = Number(args[i + 1]);
      i++;
      continue;
    }
    if (arg === '--branches' && args[i + 1]) {
      out.branches = Number(args[i + 1]);
      i++;
      continue;
    }
    if (arg === '--users-per-branch' && args[i + 1]) {
      out.usersPerBranch = Number(args[i + 1]);
      i++;
      continue;
    }
    if (arg === '--operator-id' && args[i + 1]) {
      out.operatorId = args[i + 1];
      i++;
      continue;
    }
    if (arg === '--vehicles' && args[i + 1]) {
      out.vehicles = Number(args[i + 1]);
      i++;
    }
  }

  if (!Number.isFinite(out.bookings) || out.bookings < 2) {
    out.bookings = DEFAULT_BOOKINGS;
  }

  if (!Number.isFinite(out.paidRatio) || out.paidRatio <= 0 || out.paidRatio >= 1) {
    out.paidRatio = DEFAULT_PAID_RATIO;
  }

  if (!Number.isFinite(out.branches) || out.branches < 2) {
    out.branches = DEFAULT_BRANCHES;
  }

  if (!Number.isFinite(out.usersPerBranch) || out.usersPerBranch < 1) {
    out.usersPerBranch = DEFAULT_USERS_PER_BRANCH;
  }

  if (!Number.isFinite(out.vehicles) || out.vehicles < 1) {
    out.vehicles = DEFAULT_VEHICLES;
  }

  if (!out.operatorId) {
    console.error('Missing required argument: --operator-id <operatorId>');
    process.exit(1);
  }

  return out;
};

const createBranches = async (operatorId, count) => {
  const cities = faker.helpers.shuffle([
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
    'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat'
  ]).slice(0, count);

  const branches = [];
  for (const city of cities) {
    const branch = await Branch.create({
      name: `${city} Sample Branch`,
      address: `${faker.location.streetAddress()}, ${city}, India`,
      phone: `${faker.number.int({ min: 6000000000, max: 9999999999 })}`,
      manager: faker.person.fullName(),
      status: 'Active',
      operatorId,
    });
    branches.push(branch);
  }

  return branches;
};

const createUsers = async (operatorId, branches, usersPerBranch) => {
  const users = [];
  const baseMobile = Date.now();
  let offset = 0;

  for (const branch of branches) {
    for (let i = 0; i < usersPerBranch; i++) {
      const mobile = `9${String(baseMobile + offset).slice(-9)}`;
      offset += 1;
      const user = await User.create({
        fullName: faker.person.fullName(),
        mobile,
        branchId: branch._id,
        operatorId,
        status: 'Active',
      });
      users.push(user);
    }
  }

  return users;
};

const createVehicles = async (operatorId, branches, users, count) => {
  const vehicles = [];
  const stateCodes = ['MH', 'DL', 'KA', 'TN', 'AP', 'TS', 'GJ', 'RJ', 'UP', 'WB'];

  for (let i = 0; i < count; i++) {
    const stateCode = faker.helpers.arrayElement(stateCodes);
    const vehicleNumber = `${stateCode}${faker.number.int({ min: 1, max: 99 }).toString().padStart(2, '0')}` +
      `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}` +
      `${faker.number.int({ min: 1000, max: 9999 })}`;
    const vehicle = await Vehicle.create({
      vehicleNumber,
      status: true,
      operatorId,
    });
    vehicles.push(vehicle);
  }

  return vehicles;
};

const buildBookingPayload = ({
  operatorId,
  fromOffice,
  toOffice,
  bookedBy,
  lrType,
}) => {
  const weight = faker.number.int({ min: 5, max: 50 });
  const quantity = faker.number.int({ min: 1, max: 10 });
  const valueOfGoods = faker.number.int({ min: 1000, max: 50000 });
  const freightCharge = faker.number.int({ min: 150, max: 1500 });
  const loadingCharge = faker.number.int({ min: 20, max: 200 });
  const unloadingCharge = faker.number.int({ min: 20, max: 200 });
  const gst = Math.round((freightCharge + loadingCharge + unloadingCharge) * 0.18);
  const totalAmountCharge = freightCharge + loadingCharge + unloadingCharge + gst;
  const today = moment().format('YYYY-MM-DD');

  return {
    operatorId,
    bookedBy,
    fromOffice,
    toOffice,
    senderName: faker.person.fullName(),
    senderPhone: `${faker.number.int({ min: 6000000000, max: 9999999999 })}`,
    senderEmail: faker.internet.email(),
    senderAddress: `${faker.location.streetAddress()}, ${faker.location.city()}`,
    receiverName: faker.person.fullName(),
    receiverPhone: `${faker.number.int({ min: 6000000000, max: 9999999999 })}`,
    receiverEmail: faker.internet.email(),
    receiverAddress: `${faker.location.streetAddress()}, ${faker.location.city()}`,
    dispatchDate: today,
    arrivalDate: today,
    packageDescription: faker.commerce.productName(),
    weight,
    quantity,
    valueOfGoods,
    dimensions: `${faker.number.int({ min: 10, max: 100 })}x${faker.number.int({ min: 10, max: 100 })}x${faker.number.int({ min: 10, max: 100 })} cm`,
    paymentStatus: lrType === 'Paid' ? 'Paid' : 'ToPay',
    freightCharge,
    loadingCharge,
    unloadingCharge,
    gst,
    totalAmountCharge,
    lrType,
    paymentType: lrType === 'Paid' ? faker.helpers.arrayElement(['Cash', 'UPI']) : '',
    status: 'Booked',
  };
};

const seedTodayBookings = async () => {
  const { bookings, paidRatio, branches, usersPerBranch, vehicles, operatorId } = parseArgs();
  let paidCount = Math.max(1, Math.floor(bookings * paidRatio));
  let toPayCount = bookings - paidCount;
  if (toPayCount < 1) {
    toPayCount = 1;
    paidCount = bookings - 1;
  }

  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(operatorId)) {
    console.error('Invalid operatorId supplied.');
    process.exit(1);
  }
  const operator = await Operator.findById(operatorId);
  if (!operator) {
    console.error(`Operator not found for id: ${operatorId}`);
    process.exit(1);
  }
  console.log(`Using operator ${operator.name} (${operator.code})`);

  console.log('Creating branches...');
  const createdBranches = await createBranches(operatorId, branches);
  console.log(`Created ${createdBranches.length} branches`);

  console.log('Creating users...');
  const createdUsers = await createUsers(operatorId, createdBranches, usersPerBranch);
  console.log(`Created ${createdUsers.length} users`);

  console.log('Creating vehicles...');
  const createdVehicles = await createVehicles(operatorId, createdBranches, createdUsers, vehicles);
  console.log(`Created ${createdVehicles.length} vehicles`);

  console.log('Creating bookings for today...');
  const lrTypes = [
    ...Array(paidCount).fill('Paid'),
    ...Array(toPayCount).fill('ToPay'),
  ];

  const bookingsCreated = [];
  for (const lrType of lrTypes) {
    let fromOffice = faker.helpers.arrayElement(createdBranches);
    let toOffice = faker.helpers.arrayElement(createdBranches);
    while (toOffice._id.toString() === fromOffice._id.toString()) {
      toOffice = faker.helpers.arrayElement(createdBranches);
    }

    const bookedBy = faker.helpers.arrayElement(createdUsers);
    const payload = buildBookingPayload({
      operatorId,
      fromOffice: fromOffice._id,
      toOffice: toOffice._id,
      bookedBy: bookedBy._id,
      lrType,
    });

    const booking = await BookingService.initiateBooking(payload, bookedBy._id, operatorId);
    bookingsCreated.push(booking);
  }

  console.log(`Created ${bookingsCreated.length} bookings for ${moment().format('YYYY-MM-DD')}`);
  console.log(`Paid: ${paidCount}, ToPay: ${toPayCount}`);

  await mongoose.disconnect();
  console.log('Done.');
};

seedTodayBookings().catch((error) => {
  console.error('Failed to seed today bookings:', error);
  mongoose.disconnect();
  process.exit(1);
});
