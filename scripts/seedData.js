// Import dependencies
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker/locale/en_IN');
const moment = require('moment');

// Load environment variables
require('dotenv').config({ path: '../.env' });
const config = process.env;

// Set Faker locale for Indian names and addresses
faker.locale = 'en_IND';

// Import models
const Operator = require('../models/Operator');
const Branch = require('../models/Branch');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const Vehicle = require('../models/Vehicle');
const Booking = require('../models/Booking');

// Constants
const NUM_OPERATORS = 5;
const BRANCHES_PER_OPERATOR = 5;
const USERS_PER_BRANCH = 3;
const VEHICLES_PER_OPERATOR = 10;
const MIN_BOOKINGS = 2000;
const MAX_BOOKINGS = 2500;

// Database connection
const connectDB = async () => {
  try {
    let mongoUrl = 'mongodb://' + config.DB_USER + ':' + config.DB_PASS + '@' + config.DB_HOST + '/' + config.DB_NAME;
    if (config.DB_USER && config.DB_PASS) {
      mongoUrl = 'mongodb://' + config.DB_USER + ':' + config.DB_PASS + '@' + config.DB_HOST + '/' + config.DB_NAME;
    } else {
      mongoUrl = 'mongodb://' + config.DB_HOST + ':' + config.DB_PORT + '/' + config.DB_NAME;
    }
    //mongoUrl = "mongodb://localhost/MyCargo";
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

// Password hashing helper
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Clear existing data
const clearData = async () => {
  console.log('Clearing existing data...');
  await Booking.deleteMany({});
  await Vehicle.deleteMany({});
  await User.deleteMany({
    $or: [
      { mobile: { $lt: "9999999992" } },
      { mobile: { $gt: "9999999999" } }
    ]
  });
  await Role.deleteMany({});
  await Permission.deleteMany({});
  await Branch.deleteMany({});
  await Operator.deleteMany({});
  console.log('Existing data cleared');
};

// Seed data
const seedData = async () => {
  try {
    await connectDB();
    await clearData();

    console.log('Seeding data...');

    // 1. Create Permissions
    const permissions = [
      { name: 'manage_users', description: 'Can manage users' },
      { name: 'manage_roles', description: 'Can manage roles' },
      { name: 'manage_bookings', description: 'Can manage bookings' },
      { name: 'manage_branches', description: 'Can manage branches' },
      { name: 'manage_vehicles', description: 'Can manage vehicles' },
      { name: 'view_reports', description: 'Can view reports' },
      { name: 'manage_operators', description: 'Can manage operators' },
      { name: 'manage_pricing', description: 'Can manage pricing' },
      { name: 'manage_inventory', description: 'Can manage inventory' },
      { name: 'manage_payments', description: 'Can manage payments' },
    ];

    const createdPermissions = await Permission.insertMany(permissions);
    console.log(`Created ${createdPermissions.length} permissions`);

    // 2. Create Multiple Operators
    const operatorNames = [
      'Speedy Cargo',
      'Swift Logistics',
      'Rapid Transport',
      'Quick Cargo',
      'Express Freight'
    ];

    const operators = [];
    for (let i = 0; i < NUM_OPERATORS; i++) {
      // Generate valid operator code that meets requirements (3 chars, uppercase, at least one letter)
      const nameWords = operatorNames[i].split(' ');
      let code = '';
      // Use first letter of each word until we get 3 chars
      for (let j = 0; j < nameWords.length && code.length < 3; j++) {
        code += nameWords[j][0].toUpperCase();
      }
      // If we don't have 3 chars, add numbers to complete it
      while (code.length < 3) {
        code += Math.floor(Math.random() * 10);
      }
      
      const operator = await Operator.create({
        name: operatorNames[i],
        code: code,
        address: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state()}, India`,
        phone: `${faker.number.int({ min: 6000000000, max: 9999999999 })}`,
        status: 'Active',
        bookingSequence: 1000,
        paymentOptions: ['Cash', 'UPI'],
      });
      operators.push(operator);
    }

    // 3. Create Roles for each operator
    const allRoles = [];
    const roleTemplates = [
      {
        rolename: 'SuperUser',
        description: 'System administrator with full access',
        permissions: createdPermissions.map(p => p._id)
      },
      {
        rolename: 'Admin',
        description: 'Administrator with full access',
        permissions: createdPermissions.map(p => p._id)
      },
      {
        rolename: 'Branch Manager',
        description: 'Branch manager with limited access',
        permissions: createdPermissions
          .filter(p => !['manage_roles', 'manage_users', 'manage_operators'].includes(p.name))
          .map(p => p._id)
      },
      {
        rolename: 'Staff',
        description: 'Staff member with basic access',
        permissions: createdPermissions
          .filter(p => ['view_reports', 'manage_bookings', 'manage_vehicles'].includes(p.name))
          .map(p => p._id)
      },
      {
        rolename: 'Driver',
        description: 'Driver with delivery access',
        permissions: createdPermissions
          .filter(p => ['manage_bookings'].includes(p.name))
          .map(p => p._id)
      }
    ];

    // Get all permissions
    const allPermissions = await Permission.find({});

    let superUserRole;

    // Create SuperUser account
    // Create user with mobile 9999999991 before other users
    const superUser = await User.create({
      fullName: 'SuperUser',
      email: 'admin@mycargo.com',
      mobile: '9999999991',
      password: await hashPassword('123456'),
      role: null, // Will be assigned after role creation
      operatorId: operators[0]._id, // Assign to first operator
      branchId: null, // Will be assigned to first branch
      status: 'Active',
      createdBy: null
    });
    console.log('Created SuperUser account');

    // Create SuperUser role
    superUserRole = await Role.create({
      rolename: 'SuperUser',
      description: 'System administrator with full access',
      permissions: createdPermissions.map(p => p._id),
      operatorId: operators[0]._id,
      createdBy: superUser._id
    });
    allRoles.push(superUserRole);
    // Update the super user's role
    await User.findByIdAndUpdate(superUser._id, { role: superUserRole._id });
    console.log('Assigned SuperUser role to user with mobile 9999999991');

    // Create other roles for all operators
    for (const operator of operators) {
      for (const template of roleTemplates.filter(t => t.rolename !== 'SuperUser')) {
        const role = await Role.create({
          rolename: template.rolename,
          description: template.description,
          permissions: createdPermissions.map(p => p._id),
          operatorId: operator._id,
          createdBy: superUser._id
        });
        allRoles.push(role);
      }
    }
    console.log(`Created ${await Role.countDocuments()} roles`);

    // 4. Create Branches for each operator
    const cities = [
      'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
      'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat',
      'Lucknow', 'Kanpur', 'Nagpur', 'Visakhapatnam', 'Indore',
      'Thane', 'Bhopal', 'Patna', 'Vadodara', 'Ghaziabad'
    ];

    const allBranches = [];
    for (const operator of operators) {
      const operatorBranches = [];
      const operatorCities = faker.helpers.shuffle([...cities]).slice(0, BRANCHES_PER_OPERATOR);
      
      for (let i = 0; i < operatorCities.length; i++) {
        const city = operatorCities[i];
        const branch = await Branch.create({
          name: `${city} ${faker.company.buzzAdjective()} Branch`,
          address: `${faker.location.streetAddress()}, ${city}, India`,
          phone: `${faker.number.int({ min: 6000000000, max: 9999999999 })}`,
          manager: faker.person.fullName(),
          status: 'Active',
          operatorId: operator._id,
          email: `branch.${city.toLowerCase()}@${operator.name.toLowerCase().replace(/\s+/g, '')}.com`
        });
        operatorBranches.push(branch);
        allBranches.push(branch);
      }
    }
    console.log(`Total branches created: ${allBranches.length}`);

    // Update the super user's branch
    await User.findByIdAndUpdate(superUser._id, { branchId: allBranches[0]._id });
    console.log('Assigned branch to SuperUser');

    // 5. Create Users for each branch
    const allUsers = [];
    const operatorAdminUsers = [];
    
    // Create admin user for each operator
    for (const operator of operators) {
      const adminRole = await Role.findOne({ operatorId: operator._id, rolename: 'Admin' });
      const firstBranch = await Branch.findOne({ operatorId: operator._id });
      
      if (!adminRole) {
        console.error(`No admin role found for operator ${operator.name}`);
        continue;
      }
      if (!firstBranch) {
        console.error(`No branch found for operator ${operator.name}`);
        continue;
      }
      
      const adminUser = await User.create({
        fullName: `${operator.name} Admin`,
        mobile: `${faker.number.int({ min: 6000000000, max: 9999999999 })}`,
        password: await hashPassword('123456'),
        branchId: firstBranch._id,
        role: adminRole._id,
        status: 'Active',
        operatorId: operator._id,
        email: `admin@${operator.name.toLowerCase().replace(/\s+/g, '')}.com`,
        cargoBalance: 100000,
      });
      operatorAdminUsers.push(adminUser);
      allUsers.push(adminUser);
    }
    
    // Create managers, staff, and drivers for each branch
    for (const branch of allBranches) {
      const operator = operators.find(op => op._id.toString() === branch.operatorId.toString());
      const managerRole = await Role.findOne({ operatorId: operator._id, rolename: 'Branch Manager' });
      const staffRole = await Role.findOne({ operatorId: operator._id, rolename: 'Staff' });
      const driverRole = await Role.findOne({ operatorId: operator._id, rolename: 'Driver' });
      
      // Create branch manager
      const manager = await User.create({
        fullName: `Manager ${faker.person.lastName()}`,
        mobile: `${faker.number.int({ min: 6000000000, max: 9999999999 })}`,
        password: await hashPassword('123456'),
        branchId: branch._id,
        role: managerRole._id,
        status: 'Active',
        operatorId: operator._id,
        email: `manager.${branch.name.toLowerCase().replace(/\s+/g, '')}@${operator.name.toLowerCase().replace(/\s+/g, '')}.com`,
        cargoBalance: 50000,
      });
      allUsers.push(manager);
      
      // Create staff members
      for (let i = 0; i < USERS_PER_BRANCH; i++) {
        const isStaff = Math.random() > 0.5; // 50% chance of being staff vs driver
        const role = isStaff ? staffRole : driverRole;
        const user = await User.create({
          fullName: faker.person.fullName(),
          mobile: `9${faker.number.int({ min: 100000000, max: 999999999 })}`,
          password: await hashPassword('123456'),
          branchId: branch._id,
          role: role._id,
          status: 'Active',
          operatorId: operator._id,
          email: `${faker.person.fullName()}@${operator.name.toLowerCase().replace(/\s+/g, '')}.com`,
          cargoBalance: isStaff ? 10000 : 0,
        });
        allUsers.push(user);
      }

    }
    console.log(`Total users created: ${allUsers.length}`);

    // 6. Create Vehicles for each operator
    const allVehicles = [];
    const vehicleTypes = [
      { type: 'Truck', capacity: '5000 kg' },
      { type: 'Mini Truck', capacity: '2000 kg' },
      { type: 'Pickup', capacity: '1000 kg' },
      { type: 'Tempo', capacity: '1500 kg' },
      { type: 'Bike', capacity: '50 kg' },
      { type: 'Van', capacity: '800 kg' },
      { type: 'Trailer', capacity: '10000 kg' },
    ];
    const stateCodes = ['MH', 'DL', 'KA', 'TN', 'AP', 'TS', 'GJ', 'RJ', 'UP', 'WB'];
    
    for (const operator of operators) {
      const operatorBranches = allBranches.filter(b => b.operatorId.toString() === operator._id.toString());
      
      // Find drivers for this operator
      const driverRole = await Role.findOne({ operatorId: operator._id, rolename: 'Driver' });
      if (!driverRole) {
        console.error(`No Driver role found for operator ${operator.name}`);
        continue;
      }
      
      const drivers = allUsers.filter(u => 
        u.operatorId && 
        u.operatorId.toString() === operator._id.toString() &&
        u.role && 
        u.role.toString() === driverRole._id.toString()
      );
      
      for (let i = 0; i < VEHICLES_PER_OPERATOR; i++) {
        const vehicleType = faker.helpers.arrayElement(vehicleTypes);
        const stateCode = faker.helpers.arrayElement(stateCodes);
        const vehicleNumber = `${stateCode}${faker.number.int({ min: 1, max: 99 }).toString().padStart(2, '0')}` +
          `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}` +
          `${faker.number.int({ min: 1000, max: 9999 })}`;
        
        const statuses = ['Available', 'In Transit', 'Maintenance'];
        const status = faker.helpers.arrayElement(statuses);
        const currentBranch = faker.helpers.arrayElement(operatorBranches);
        const driver = drivers.length > 0 ? faker.helpers.arrayElement(drivers) : null;
        
        const vehicle = await Vehicle.create({
          vehicleNumber: vehicleNumber,
          type: vehicleType.type,
          capacity: vehicleType.capacity,
          driver: driver ? driver.fullName : 'Unassigned',
          driverId: driver ? driver._id : null,
          status: status,
          currentLocation: currentBranch.name,
          currentBranchId: currentBranch._id,
          operatorId: operator._id,
          lastMaintenanceDate: faker.date.past({ years: 1 }),
          nextMaintenanceDate: faker.date.soon({ days: 180 }),
          insuranceExpiry: faker.date.soon({ days: 365 }),
          registrationNumber: vehicleNumber,
          model: `${faker.vehicle.manufacturer()} ${faker.vehicle.model()}`,
          year: faker.date.past({ years: 10 }).getFullYear(),
          color: faker.vehicle.color(),
        });
        
        allVehicles.push(vehicle);
      }

    }
    console.log(`Total vehicles created: ${allVehicles.length}`);

    // 7. Create Bookings - Generate 2000-2500 bookings over last 6 months
    const numBookings = faker.number.int({ min: MIN_BOOKINGS, max: MAX_BOOKINGS });
    const packageTypes = ['Electronics', 'Clothing', 'Documents', 'Furniture', 'Food', 'Medical', 'Automotive', 'Industrial', 'Retail', 'Personal'];
    const statuses = ['Booked', 'InTransit', 'Cancelled', 'Arrived', 'Delivered'];
    const lrTypes = ['Paid', 'ToPay'];
    const paymentModes = ['Cash', 'UPI'];
    const bookingSources = ['Web', 'Mobile', 'Walk-in', 'Call', 'Email', 'Partner'];
    const currentDay = moment().format('YYYY-MM-DD');
    
    // Helper function to generate a random date within the last 6 months
    const randomDate = (includeCurrent = false) => {
      const sixMonthsAgo = moment().subtract(6, 'months').toDate();
      if (includeCurrent && Math.random() < 0.1) { // 10% chance for current date
        return currentDay;
      }
      return faker.date.between({ from: sixMonthsAgo, to: new Date() });
    };
    
    // Helper function to generate a random tracking number
    const generateTrackingNumber = (operatorCode, sequence) => {
      const date = moment().format('YYMMDD');
      return `${operatorCode}${date}${sequence.toString().padStart(6, '0')}`;
    };
    
    // Group users and branches by operator for faster access
    const usersByOperator = {};
    const branchesByOperator = {};
    const vehiclesByOperator = {};
    
    for (const operator of operators) {
      const operatorId = operator._id.toString();
      usersByOperator[operatorId] = allUsers.filter(u => u.operatorId.toString() === operatorId);
      branchesByOperator[operatorId] = allBranches.filter(b => b.operatorId.toString() === operatorId);
      vehiclesByOperator[operatorId] = allVehicles.filter(v => v.operatorId.toString() === operatorId);
    }
    // Process bookings in batches to avoid memory issues
    const batchSize = 100;
    let bookingCount = 0;
    const operatorSequence = {};
    const branchBookings = new Map(); // Track bookings per branch
    
    // Initialize sequence counters for each operator
    for (const operator of operators) {
      operatorSequence[operator._id.toString()] = 1000; // Start sequence from 1000 for each operator
    }
    
    // Initialize branch bookings tracking
    for (const operator of operators) {
      const operatorBranches = branchesByOperator[operator._id.toString()];
      for (const branch of operatorBranches) {
        branchBookings.set(branch._id.toString(), {
          paid: 0,
          toPay: 0,
          total: 0
        });
      }
    }

    // Add a debug function to check LR type distribution
    const debugLRDistribution = () => {
      console.log('\nLR Type Distribution:');
      console.log('Branch ID\tPaid\tToPay\tTotal\tRatio');
      branchBookings.forEach((stats, branchId) => {
        const total = stats.paid + stats.toPay;
        const ratio = total > 0 ? (stats.toPay / total * 100).toFixed(1) : 0;
        console.log(`${branchId}\t${stats.paid}\t${stats.toPay}\t${total}\t${ratio}%`);
      });
    };
    
    while (bookingCount < numBookings) {
      const currentBatchSize = Math.min(batchSize, numBookings - bookingCount);
      const bookingBatch = [];

      // Debug LR distribution every 1000 bookings
      if (bookingCount % 1000 === 0 && bookingCount > 0) {
        debugLRDistribution();
      }
      
      for (let i = 0; i < currentBatchSize; i++) {
        // Select a random operator
        const operator = faker.helpers.arrayElement(operators);
        const operatorUsers = usersByOperator[operator._id.toString()];
        const operatorBranches = branchesByOperator[operator._id.toString()];
        const operatorVehicles = vehiclesByOperator[operator._id.toString()];
        
        if (operatorUsers.length === 0 || operatorBranches.length < 2) continue; // Skip if not enough data
        
        // Select random from and to branches (must be different)
        let fromBranch, toBranch;
        do {
          fromBranch = faker.helpers.arrayElement(operatorBranches);
          toBranch = faker.helpers.arrayElement(operatorBranches);
        } while (fromBranch._id.toString() === toBranch._id.toString());
        
        // Determine LR type - alternate between Paid and ToPay for better distribution
        const lrType = bookingCount % 2 === 0 ? 'Paid' : 'ToPay';
        
        // Update branch statistics
        const branchStats = branchBookings.get(fromBranch._id.toString());
        branchStats[lrType.toLowerCase()]++;
        branchStats.total++;
        branchBookings.set(fromBranch._id.toString(), branchStats); // Save updated stats back to Map
        
        // Increment and get the next sequence number for this operator
        const sequence = operatorSequence[operator._id.toString()]++;
        const trackingNumber = generateTrackingNumber(operator.code, sequence);
        
        // Generate random booking date within last 6 months
        let bookingDate = randomDate(true);
        const bookingMoment = moment(bookingDate);
        bookingDate = bookingMoment.format('YYYY-MM-DD');
        
        // Select random user who made the booking (filter by operator and branch)
        const branchUsers = operatorUsers.filter(u => u.branchId.toString() === fromBranch._id.toString());
        if (branchUsers.length === 0) continue; // Skip if no users in this branch
        
        const bookedBy = faker.helpers.arrayElement(branchUsers);
        
        // Generate random package details
        const packageType = faker.helpers.arrayElement(packageTypes);
        const weight = faker.number.float({ min: 0.5, max: 50, precision: 0.1 });
        const quantity = faker.number.int({ min: 1, max: 10 });
        const valueOfGoods = faker.number.int({ min: 100, max: 100000 });
        const dimensions = `${faker.number.int({ min: 10, max: 100 })}x` +
                         `${faker.number.int({ min: 10, max: 100 })}x` +
                         `${faker.number.int({ min: 5, max: 50 })} cm`;
        
        // Determine status and related dates
        const status = faker.helpers.arrayElement(statuses);
        const paymentMode = faker.helpers.arrayElement(paymentModes);
        const source = faker.helpers.arrayElement(bookingSources);
        
        // Generate dates based on status
        let pickupDate, inTransitDate, arrivedDate, outForDeliveryDate, deliveredDate, cancelledDate, returnDate;
        
        if (['InTransit', 'Arrived', 'OutForDelivery', 'Delivered', 'Returned'].includes(status)) {
          pickupDate = faker.date.between({ from: bookingDate, to: moment(bookingDate).add(1, 'day').toDate() });
        }
        
        if (['InTransit', 'Arrived', 'OutForDelivery', 'Delivered', 'Returned'].includes(status)) {
          inTransitDate = faker.date.between({ from: pickupDate || bookingDate, to: moment(bookingDate).add(3, 'days').toDate() });
        }
        
        if (['Arrived', 'OutForDelivery', 'Delivered', 'Returned'].includes(status)) {
          arrivedDate = faker.date.between({ from: inTransitDate || bookingDate, to: moment(bookingDate).add(5, 'days').toDate() });
        }
        
        if (['OutForDelivery', 'Delivered', 'Returned'].includes(status)) {
          outForDeliveryDate = faker.date.between({ from: arrivedDate || inTransitDate || bookingDate, to: moment(bookingDate).add(7, 'days').toDate() });
        }
        
        if (['Delivered', 'Returned'].includes(status)) {
          deliveredDate = faker.date.between({ from: outForDeliveryDate || arrivedDate || inTransitDate || bookingDate, to: moment(bookingDate).add(10, 'days').toDate() });
        }
        
        if (status === 'Cancelled') {
          cancelledDate = faker.date.between({ from: bookingDate, to: moment(bookingDate).add(2, 'days').toDate() });
        }
        
        if (status === 'Returned') {
          returnDate = faker.date.between({ from: deliveredDate || bookingDate, to: moment(bookingDate).add(14, 'days').toDate() });
        }
        
        // Select a random vehicle (if in transit or delivered)
        let assignedVehicle = null;
        if (['InTransit', 'Arrived', 'OutForDelivery', 'Delivered', 'Returned'].includes(status) && operatorVehicles.length > 0) {
          assignedVehicle = faker.helpers.arrayElement(operatorVehicles)._id;
        }
        
        // Create the booking object
        // Generate booking ID with sequence
        const bookingId = `${lrType === 'Paid' ? 'P' : 'TP'}-${operator.code}-${sequence.toString().padStart(6, '0')}`;
        
        // Update branch LR type statistics
        branchStats[lrType.toLowerCase()]++;
        
        // Create the booking object
        const booking = {
          bookingId: bookingId,
          bookingNumber: trackingNumber,
          bookingDate: bookingDate,
          trackingNumber: trackingNumber,
          senderName: faker.person.fullName(),
          senderPhone: `${faker.number.int({ min: 100000000, max: 999999999 })}`,
          senderEmail: faker.internet.email().toLowerCase(),
          senderAddress: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state()}, India`,
          receiverName: faker.person.fullName(),
          receiverPhone: `${faker.number.int({ min: 100000000, max: 999999999 })}`,
          receiverEmail: faker.internet.email().toLowerCase(),
          receiverAddress: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state()}, India`,
          fromOffice: fromBranch._id,
          toOffice: toBranch._id,
          packageDescription: packageType,
          packageType: packageType,
          weight: weight,
          quantity: quantity,
          valueOfGoods: valueOfGoods,
          dimensions: dimensions,
          status: status,
          lrType: lrType,
          paymentMode: paymentMode,
          source: source,
          bookedBy: bookedBy._id,
          operatorId: operator._id,
          pickupDate: pickupDate,
          inTransitDate: inTransitDate,
          arrivedDate: arrivedDate,
          outForDeliveryDate: outForDeliveryDate,
          deliveredDate: deliveredDate,
          cancelledDate: cancelledDate,
          returnDate: returnDate,
          assignedVehicle: assignedVehicle,
          deliveryCharges: faker.number.int({ min: 100, max: 5000 }),
          taxAmount: faker.number.int({ min: 10, max: 500 }),
          totalAmount: 0, // Will be calculated
          advanceAmount: lrType === 'Paid' ? faker.number.int({ min: 100, max: 5000 }) : 0,
          balanceAmount: 0, // Will be calculated
          notes: faker.lorem.sentence(),
          isFragile: faker.datatype.boolean(),
          isHazardous: faker.datatype.boolean(),
          isPerishable: faker.datatype.boolean(),
          isReturn: faker.datatype.boolean(0.1), // 10% chance of being a return
          createdAt: bookingDate,
          updatedAt: new Date(),
        };
        
        // Calculate amounts
        booking.totalAmount = booking.deliveryCharges + booking.taxAmount;
        booking.balanceAmount = booking.totalAmount - (booking.advanceAmount || 0);
        
        bookingBatch.push(booking);
        bookingCount++;
      }
      
      // Insert the current batch
      if (bookingBatch.length > 0) {
        await Booking.insertMany(bookingBatch);
        if (bookingCount % 1000 === 0 || bookingCount === numBookings) {
          console.log(`Created ${bookingCount} / ${numBookings} bookings (${Math.round((bookingCount / numBookings) * 100)}%)`);
        }
      }
    }
    console.log('Data seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

// Run the seed function
seedData();
