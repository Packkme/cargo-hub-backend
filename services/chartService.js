const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const requestContext = require('../utils/requestContext');
const mongoose = require('mongoose');

// Get today's bookings segregated by payment type (ToPay/Paid)
exports.getTodayBookingsByPayment = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const operatorId = requestContext.getOperatorId();

        const result = await Booking.aggregate([
            {
                $match: {
                    bookingDate: today,
                    operatorId: operatorId
                }
            },
            {
                $group: {
                    _id: '$lrType',
                    totalAmount: {
                        $sum: {
                            $ifNull: ['$totalAmountCharge', 0]
                        }
                    }
                }
            }
        ]);

        const pieChartData = [
            { label: 'To Pay', value: 0 },
            { label: 'Paid', value: 0 }
        ];

        result.forEach(item => {
            const label = item._id === 'ToPay' ? 'To Pay' : 'Paid';
            const existingItem = pieChartData.find(p => p.label === label);
            if (existingItem) {
                existingItem.value = item.totalAmount;
            }
        });

        return pieChartData;
    } catch (error) {
        throw error;
    }
};

// Get ToPay and Paid bookings across all branches
exports.getBookingsByBranchAndPayment = async () => {
    try {
        const operatorId = requestContext.getOperatorId();
        const branches = await Branch.find({ operatorId });
        const branchMap = new Map(branches.map(branch => [branch._id.toString(), branch.name]));
        const validBranches = await Branch.find({ operatorId });
        const validBranchIds = validBranches.map(branch => branch._id);
        const today = new Date().toISOString().split('T')[0];

        const result = await Booking.aggregate([
            {
                $match: {
                    operatorId: operatorId,
                    bookingDate: today,
                    fromOffice: { $in: validBranchIds }
                }
            },
            {
                $group: {
                    _id: {
                        branch: '$fromOffice',
                        paymentType: '$lrType'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const formattedData = result.reduce((acc, item) => {
            const branchId = item._id.branch.toString();
            const branchName = branchMap.get(branchId);
            const paymentType = item._id.paymentType;
            
            if (!acc[branchName]) {
                acc[branchName] = {
                    branchName,
                    toPay: 0,
                    paid: 0
                };
            }
            
            if (paymentType === 'ToPay') {
                acc[branchName].toPay = item.count;
            } else {
                acc[branchName].paid = item.count;
            }
            
            return acc;
        }, {});

        return Object.values(formattedData);
    } catch (error) {
        throw error;
    }
};

// Get bookings for last 6 months grouped by month and payment type
exports.getSixMonthBookings = async (month) => {
    try {
        const operatorId = requestContext.getOperatorId();
        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 5);

        const startDate = sixMonthsAgo.toISOString().split('T')[0];
        const endDate = now.toISOString().split('T')[0];

        const aggregatedBookings = await Booking.aggregate([
            {
                $match: {
                    operatorId: operatorId,
                    bookingDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $substrBytes: ['$bookingDate', 0, 7] },
                        paymentType: '$lrType'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.month': 1 }
            }
        ]);

        const monthlyData = {};
        const months = [];

        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = monthDate.toLocaleString('default', { month: 'short' });
            const year = monthDate.getFullYear();
            const key = `${monthName} ${year}`;
            months.push(key);
            monthlyData[key] = { month: key, toPay: 0, paid: 0 };
        }

        aggregatedBookings.forEach(item => {
            const [year, month] = item._id.month.split('-');
            const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'short' });
            const key = `${monthName} ${year}`;
            const type = (item._id.paymentType || '').toLowerCase();

            if (monthlyData[key]) {
                if (type === 'topay') {
                    monthlyData[key].toPay = item.count;
                } else {
                    monthlyData[key].paid = item.count;
                }
            }
        });

        const allData = Object.values(monthlyData);
        return month ? allData.filter(entry => entry.month.toLowerCase() === month.toLowerCase()) : allData;
    } catch (error) {
        throw error;
    }
};

// Get pending bookings by branch location, categorized by payment type (Paid/ToPay)
exports.getPendingBookingsByBranch = async () => {
    try {
        const operatorId = requestContext.getOperatorId();

        // First, get all branches for the operator
        const branches = await Branch.find({ operatorId });

        // Get pending bookings grouped by branch and payment type
        const pendingDeliveries = await Booking.aggregate([
            {
                $match: {
                    operatorId: new mongoose.Types.ObjectId(operatorId),
                    status: { $in: ['Booked', 'InTransit', 'Arrived'] }
                }
            },
            {
                $lookup: {
                    from: 'branches',
                    localField: 'fromOffice',
                    foreignField: '_id',
                    as: 'branch'
                }
            },
            { $unwind: '$branch' },
            {
                $group: {
                    _id: {
                        branchId: '$fromOffice',
                        branchName: '$branch.name',
                        lrType: '$lrType'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: {
                        branchId: '$_id.branchId',
                        branchName: '$_id.branchName'
                    },
                    deliveries: {
                        $push: {
                            lrType: '$_id.lrType',
                            count: '$count'
                        }
                    },
                    total: { $sum: '$count' }
                }
            },
            { $sort: { total: -1 } }
        ]);

        const formattedData = branches.map(branch => {
            const branchData = pendingDeliveries.find(d => d._id.branchId.equals(branch._id)) ||
                { _id: { branchId: branch._id, branchName: branch.name }, deliveries: [], total: 0 };

            // Ensure both Paid and ToPay are included with 0 if not present
            const paidData = branchData.deliveries.find(d => d.lrType === 'Paid') || { lrType: 'Paid', count: 0 };
            const toPayData = branchData.deliveries.find(d => d.lrType === 'ToPay') || { lrType: 'ToPay', count: 0 };

            return {
                branchId: branch._id,
                branchName: branch.name,
                paidCount: paidData.count,
                toPayCount: toPayData.count,
                total: branchData.total
            };
        });

        return Object.values(formattedData);
    } catch (error) {
        throw error;
    }
};