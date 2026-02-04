const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const requestContext = require('../utils/requestContext');
const mongoose = require('mongoose');
const { buildOperatorFilter, appendOperatorFilter } = require('../utils/operatorFilter');

// Get today's bookings segregated by payment type (ToPay/Paid)
exports.getTodayBookingsByPayment = async ({ date } = {}) => {
    try {
        const operatorId = requestContext.getOperatorId();
        let parsedDate;
        if (date) {
            parsedDate = new Date(date);
            if (Number.isNaN(parsedDate.getTime())) {
                const invalidDateError = new Error('Invalid date format. Use YYYY-MM-DD');
                invalidDateError.statusCode = 400;
                throw invalidDateError;
            }
        } else {
            parsedDate = new Date();
        }
        const targetDate = parsedDate.toISOString().split('T')[0];

        const result = await Booking.aggregate([
            {
                $match: appendOperatorFilter({
                    bookingDate: targetDate
                }, operatorId)
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
exports.getBookingsByBranchAndPayment = async ({ date } = {}) => {
    try {
        const operatorId = requestContext.getOperatorId();
        const branches = await Branch.find(buildOperatorFilter(operatorId));
        const branchMap = new Map(branches.map(branch => [branch._id.toString(), branch.name]));
        const validBranchIds = branches.map(branch => branch._id);

        let parsedDate;
        if (date) {
            parsedDate = new Date(date);
            if (Number.isNaN(parsedDate.getTime())) {
                const invalidDateError = new Error('Invalid date format. Use YYYY-MM-DD');
                invalidDateError.statusCode = 400;
                throw invalidDateError;
            }
        } else {
            parsedDate = new Date();
        }
        const targetDate = parsedDate.toISOString().split('T')[0];

        const result = await Booking.aggregate([
            {
                $match: appendOperatorFilter({
                    bookingDate: targetDate,
                    fromOffice: { $in: validBranchIds }
                }, operatorId)
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
                $match: appendOperatorFilter({
                    bookingDate: { $gte: startDate, $lte: endDate }
                }, operatorId)
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
        const branches = await Branch.find(buildOperatorFilter(operatorId));

        // Get pending bookings grouped by branch and payment type
        const pendingDeliveries = await Booking.aggregate([
            {
                $match: appendOperatorFilter({
                    status: { $in: ['Booked', 'InTransit', 'Arrived'] }
                }, operatorId && mongoose.Types.ObjectId.isValid(operatorId)
                    ? new mongoose.Types.ObjectId(operatorId)
                    : operatorId)
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

// Get booking totals per branch (Paid/ToPay sums)
exports.getBookingTotalsByBranch = async ({ date } = {}) => {
    try {
        const operatorId = requestContext.getOperatorId();
        let parsedDate;
        if (date) {
            parsedDate = new Date(date);
            if (Number.isNaN(parsedDate.getTime())) {
                const invalidDateError = new Error('Invalid date format. Use YYYY-MM-DD');
                invalidDateError.statusCode = 400;
                throw invalidDateError;
            }
        } else {
            parsedDate = new Date();
        }
        const dateString = parsedDate.toISOString().split('T')[0];

        const matchStage = {
            bookingDate: dateString
        };

        if (operatorId) {
            matchStage.operatorId = operatorId;
        }

        const pipeline = [
            { $match: matchStage },
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
                        branchId: '$branch._id',
                        branchName: '$branch.name',
                        paymentType: '$lrType'
                    },
                    totalAmount: {
                        $sum: {
                            $ifNull: ['$totalAmountCharge', 0]
                        }
                    }
                }
            }
        ];

        const aggregateResult = await Booking.aggregate(pipeline);
        const branchTotals = {};

        aggregateResult.forEach(item => {
            const branchLabel = item._id.branchName || 'Unknown';
            const branchId = item._id.branchId ? item._id.branchId.toString() : 'unknown';
            if (!branchTotals[branchId]) {
                branchTotals[branchId] = {
                    branchId,
                    branchName: branchLabel,
                    paid: 0,
                    toPay: 0,
                    total: 0
                };
            }

            const paymentType = (item._id.paymentType || '').toLowerCase();
            const amount = item.totalAmount || 0;
            if (paymentType === 'topay') {
                branchTotals[branchId].toPay = amount;
            } else {
                branchTotals[branchId].paid = amount;
            }

            branchTotals[branchId].total = branchTotals[branchId].paid + branchTotals[branchId].toPay;
        });

        return Object.values(branchTotals).sort((a, b) => a.branchName.localeCompare(b.branchName));
    } catch (error) {
        throw error;
    }
};

// Get booking totals from a branch to destination branches (Paid/ToPay sums)
exports.getBookingTotalsByBranchDestination = async ({ fromBranchId, date } = {}) => {
    try {
        if (!fromBranchId) {
            const missingBranchError = new Error('fromBranchId is required');
            missingBranchError.statusCode = 400;
            throw missingBranchError;
        }

        const operatorId = requestContext.getOperatorId();
        let parsedDate;
        if (date) {
            parsedDate = new Date(date);
            if (Number.isNaN(parsedDate.getTime())) {
                const invalidDateError = new Error('Invalid date format. Use YYYY-MM-DD');
                invalidDateError.statusCode = 400;
                throw invalidDateError;
            }
        } else {
            parsedDate = new Date();
        }
        const dateString = parsedDate.toISOString().split('T')[0];

        const matchStage = {
            bookingDate: dateString,
            fromOffice: new mongoose.Types.ObjectId(fromBranchId)
        };

        if (operatorId) {
            matchStage.operatorId = operatorId;
        }

        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'branches',
                    localField: 'toOffice',
                    foreignField: '_id',
                    as: 'branch'
                }
            },
            { $unwind: '$branch' },
            {
                $group: {
                    _id: {
                        branchId: '$branch._id',
                        branchName: '$branch.name',
                        paymentType: '$lrType'
                    },
                    totalAmount: {
                        $sum: {
                            $ifNull: ['$totalAmountCharge', 0]
                        }
                    }
                }
            }
        ];

        const aggregateResult = await Booking.aggregate(pipeline);
        const branchTotals = {};

        aggregateResult.forEach(item => {
            const branchLabel = item._id.branchName || 'Unknown';
            const branchId = item._id.branchId ? item._id.branchId.toString() : 'unknown';
            if (!branchTotals[branchId]) {
                branchTotals[branchId] = {
                    branchId,
                    branchName: branchLabel,
                    paid: 0,
                    toPay: 0,
                    total: 0
                };
            }

            const paymentType = (item._id.paymentType || '').toLowerCase();
            const amount = item.totalAmount || 0;
            if (paymentType === 'topay') {
                branchTotals[branchId].toPay = amount;
            } else {
                branchTotals[branchId].paid = amount;
            }

            branchTotals[branchId].total = branchTotals[branchId].paid + branchTotals[branchId].toPay;
        });

        return Object.values(branchTotals).sort((a, b) => a.branchName.localeCompare(b.branchName));
    } catch (error) {
        throw error;
    }
};


// Get booking totals per user with optional filters
exports.getBookingTotalsByUser = async ({ userName, bookingType = 'all', date } = {}) => {
    try {
        const operatorId = requestContext.getOperatorId();
        const allowedTypes = ['paid', 'topay', 'all'];
        const normalizedBookingType = allowedTypes.includes((bookingType || 'all').toLowerCase())
            ? (bookingType || 'all').toLowerCase()
            : 'all';

        let parsedDate;
        if (date) {
            parsedDate = new Date(date);
            if (Number.isNaN(parsedDate.getTime())) {
                const invalidDateError = new Error('Invalid date format. Use YYYY-MM-DD');
                invalidDateError.statusCode = 400;
                throw invalidDateError;
            }
        } else {
            parsedDate = new Date();
        }
        const dateString = parsedDate.toISOString().split('T')[0];

        const matchStage = { bookingDate: dateString };

        if (operatorId) {
            matchStage.operatorId = operatorId;
        }

        if (normalizedBookingType !== 'all') {
            matchStage.lrType = normalizedBookingType === 'paid' ? 'Paid' : 'ToPay';
        }

        const pipeline = [
            { $match: matchStage },
            { $match: { bookedBy: { $ne: null } } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'bookedBy',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' }
        ];

        if (userName) {
            pipeline.push({
                $match: { 'user.fullName': { $regex: userName, $options: 'i' } }
            });
        }

        pipeline.push({
            $group: {
                _id: {
                    userId: '$user._id',
                    userName: '$user.fullName',
                    paymentType: '$lrType'
                },
                totalAmount: {
                    $sum: {
                        $ifNull: ['$totalAmountCharge', 0]
                    }
                }
            }
        });

        const aggregateResult = await Booking.aggregate(pipeline);
        const userTotals = {};

        aggregateResult.forEach(item => {
            const label = item._id.userName || 'Unknown';
            const userId = item._id.userId ? item._id.userId.toString() : 'unknown';
            if (!userTotals[userId]) {
                userTotals[userId] = { userId, userName: label, paid: 0, toPay: 0, total: 0 };
            }

            const paymentType = (item._id.paymentType || '').toLowerCase();
            const amount = item.totalAmount || 0;
            if (paymentType === 'topay') {
                userTotals[userId].toPay = amount;
            } else {
                userTotals[userId].paid = amount;
            }

            userTotals[userId].total = userTotals[userId].paid + userTotals[userId].toPay;
        });

        return Object.values(userTotals).sort((a, b) => a.userName.localeCompare(b.userName));
    } catch (error) {
        throw error;
    }
};

// Get booking totals from a user to destination branches (Paid/ToPay sums)
exports.getBookingTotalsByUserDestination = async ({ fromUserId, date } = {}) => {
    try {
        if (!fromUserId) {
            const missingUserError = new Error('fromUserId is required');
            missingUserError.statusCode = 400;
            throw missingUserError;
        }

        const operatorId = requestContext.getOperatorId();
        let parsedDate;
        if (date) {
            parsedDate = new Date(date);
            if (Number.isNaN(parsedDate.getTime())) {
                const invalidDateError = new Error('Invalid date format. Use YYYY-MM-DD');
                invalidDateError.statusCode = 400;
                throw invalidDateError;
            }
        } else {
            parsedDate = new Date();
        }
        const dateString = parsedDate.toISOString().split('T')[0];

        const matchStage = {
            bookingDate: dateString,
            bookedBy: new mongoose.Types.ObjectId(fromUserId)
        };

        if (operatorId) {
            matchStage.operatorId = operatorId;
        }

        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'branches',
                    localField: 'toOffice',
                    foreignField: '_id',
                    as: 'branch'
                }
            },
            { $unwind: '$branch' },
            {
                $group: {
                    _id: {
                        branchId: '$branch._id',
                        branchName: '$branch.name',
                        paymentType: '$lrType'
                    },
                    totalAmount: {
                        $sum: {
                            $ifNull: ['$totalAmountCharge', 0]
                        }
                    }
                }
            }
        ];

        const aggregateResult = await Booking.aggregate(pipeline);
        const branchTotals = {};

        aggregateResult.forEach(item => {
            const branchLabel = item._id.branchName || 'Unknown';
            const branchId = item._id.branchId ? item._id.branchId.toString() : 'unknown';
            if (!branchTotals[branchId]) {
                branchTotals[branchId] = {
                    branchId,
                    branchName: branchLabel,
                    paid: 0,
                    toPay: 0,
                    total: 0
                };
            }

            const paymentType = (item._id.paymentType || '').toLowerCase();
            const amount = item.totalAmount || 0;
            if (paymentType === 'topay') {
                branchTotals[branchId].toPay = amount;
            } else {
                branchTotals[branchId].paid = amount;
            }

            branchTotals[branchId].total = branchTotals[branchId].paid + branchTotals[branchId].toPay;
        });

        return Object.values(branchTotals).sort((a, b) => a.branchName.localeCompare(b.branchName));
    } catch (error) {
        throw error;
    }
};
