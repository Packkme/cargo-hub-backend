const mongoose = require('mongoose');

module.exports = {
  version: 1,
  description: 'Add performance indexes for multi-tenant queries',
  
  async up() {
    const db = mongoose.connection.db;
    
    // User indexes
    await db.collection('users').createIndex({ operatorId: 1, mobile: 1 }, { unique: true });
    await db.collection('users').createIndex({ operatorId: 1, status: 1 });
    await db.collection('users').createIndex({ operatorId: 1, branchId: 1 });
    
    // Branch indexes
    await db.collection('branches').createIndex({ operatorId: 1, status: 1 });
    await db.collection('branches').createIndex({ operatorId: 1, name: 1 });
    
    // Booking indexes
    await db.collection('bookings').createIndex({ operatorId: 1, bookingDate: -1 });
    await db.collection('bookings').createIndex({ operatorId: 1, senderPhone: 1 });
    await db.collection('bookings').createIndex({ operatorId: 1, receiverPhone: 1 });
    await db.collection('bookings').createIndex({ operatorId: 1, fromOffice: 1, toOffice: 1 });
    await db.collection('bookings').createIndex({ operatorId: 1, 'eventHistory.type': 1 });
    
    // Vehicle indexes
    await db.collection('vehicles').createIndex({ operatorId: 1, status: 1 });
    await db.collection('vehicles').createIndex({ operatorId: 1, vehicleNumber: 1 }, { unique: true });
    
    // Transaction indexes
    await db.collection('transactions').createIndex({ operatorId: 1, createdAt: -1 });
    await db.collection('transactions').createIndex({ operatorId: 1, bookingId: 1 });
    
    // Cash Transfer indexes
    await db.collection('cashtransfers').createIndex({ operatorId: 1, createdAt: -1 });
    await db.collection('cashtransfers').createIndex({ operatorId: 1, fromBranch: 1, toBranch: 1 });
    
    // Role indexes
    await db.collection('roles').createIndex({ rolename: 1 }, { unique: true });
    
    console.log('Performance indexes created successfully');
  },
  
  async down() {
    const db = mongoose.connection.db;
    
    // Drop indexes (only custom ones, not _id)
    await db.collection('users').dropIndex({ operatorId: 1, mobile: 1 });
    await db.collection('users').dropIndex({ operatorId: 1, status: 1 });
    await db.collection('users').dropIndex({ operatorId: 1, branchId: 1 });
    
    await db.collection('branches').dropIndex({ operatorId: 1, status: 1 });
    await db.collection('branches').dropIndex({ operatorId: 1, name: 1 });
    
    await db.collection('bookings').dropIndex({ operatorId: 1, bookingDate: -1 });
    await db.collection('bookings').dropIndex({ operatorId: 1, senderPhone: 1 });
    await db.collection('bookings').dropIndex({ operatorId: 1, receiverPhone: 1 });
    await db.collection('bookings').dropIndex({ operatorId: 1, fromOffice: 1, toOffice: 1 });
    await db.collection('bookings').dropIndex({ operatorId: 1, 'eventHistory.type': 1 });
    
    await db.collection('vehicles').dropIndex({ operatorId: 1, status: 1 });
    await db.collection('vehicles').dropIndex({ operatorId: 1, vehicleNumber: 1 });
    
    await db.collection('transactions').dropIndex({ operatorId: 1, createdAt: -1 });
    await db.collection('transactions').dropIndex({ operatorId: 1, bookingId: 1 });
    
    await db.collection('cashtransfers').dropIndex({ operatorId: 1, createdAt: -1 });
    await db.collection('cashtransfers').dropIndex({ operatorId: 1, fromBranch: 1, toBranch: 1 });
    
    await db.collection('roles').dropIndex({ rolename: 1 });
    
    console.log('Performance indexes removed successfully');
  }
};
