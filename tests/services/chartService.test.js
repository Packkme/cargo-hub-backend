jest.mock('../../models/Booking', () => ({
    aggregate: jest.fn()
}));

jest.mock('../../models/Branch', () => ({
    find: jest.fn()
}));

jest.mock('../../utils/requestContext', () => ({
    getOperatorId: jest.fn()
}));

const Booking = require('../../models/Booking');
const Branch = require('../../models/Branch');
const requestContext = require('../../utils/requestContext');
const chartService = require('../../services/chartService');

describe('chartService.getTodayBookingsByPayment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns total amount collected for each payment type', async () => {
        const operatorId = 'operator-123';
        requestContext.getOperatorId.mockReturnValue(operatorId);

        Booking.aggregate.mockResolvedValue([
            { _id: 'ToPay', totalAmount: 5200 },
            { _id: 'Paid', totalAmount: 1800 }
        ]);

        const result = await chartService.getTodayBookingsByPayment({ date: '2026-01-28' });

        expect(Booking.aggregate).toHaveBeenCalledWith([
            {
                $match: {
                    bookingDate: '2026-01-28',
                    operatorId
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

        expect(result).toEqual([
            { label: 'To Pay', value: 5200 },
            { label: 'Paid', value: 1800 }
        ]);
    });

    it('keeps zero for payment types without bookings', async () => {
        requestContext.getOperatorId.mockReturnValue('operator-456');
        Booking.aggregate.mockResolvedValue([
            { _id: 'ToPay', totalAmount: 900 }
        ]);

        const result = await chartService.getTodayBookingsByPayment({ date: '2026-01-29' });

        expect(Booking.aggregate).toHaveBeenCalledWith([
            {
                $match: {
                    bookingDate: '2026-01-29',
                    operatorId: 'operator-456'
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

        expect(result).toEqual([
            { label: 'To Pay', value: 900 },
            { label: 'Paid', value: 0 }
        ]);
    });

    it('throws for invalid date strings', async () => {
        await expect(chartService.getTodayBookingsByPayment({ date: 'invalid-date' })).rejects.toMatchObject({
            message: 'Invalid date format. Use YYYY-MM-DD',
            statusCode: 400
        });
    });
});



describe('chartService.getBookingsByBranchAndPayment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        requestContext.getOperatorId.mockReturnValue('operator-xyz');
    });

    it('aggregates counts for branches on provided date', async () => {
        Branch.find.mockResolvedValue([
            { _id: 'branchA', name: 'Hyderabad' },
            { _id: 'branchB', name: 'Vijayawada' }
        ]);

        Booking.aggregate.mockResolvedValue([
            { _id: { branch: 'branchA', paymentType: 'Paid' }, count: 10 },
            { _id: { branch: 'branchA', paymentType: 'ToPay' }, count: 4 },
            { _id: { branch: 'branchB', paymentType: 'Paid' }, count: 6 }
        ]);

        const result = await chartService.getBookingsByBranchAndPayment({ date: '2026-02-01' });

        expect(Branch.find).toHaveBeenCalledWith({ operatorId: 'operator-xyz' });
        expect(Booking.aggregate).toHaveBeenCalledWith([
            {
                $match: {
                    operatorId: 'operator-xyz',
                    bookingDate: '2026-02-01',
                    fromOffice: { $in: ['branchA', 'branchB'] }
                }
            },
            {
                $group: {
                    _id: { branch: '$fromOffice', paymentType: '$lrType' },
                    count: { $sum: 1 }
                }
            }
        ]);

        expect(result).toEqual([
            { branchName: 'Hyderabad', toPay: 4, paid: 10 },
            { branchName: 'Vijayawada', toPay: 0, paid: 6 }
        ]);
    });

    it('throws for invalid date strings', async () => {
        Branch.find.mockResolvedValue([]);
        await expect(chartService.getBookingsByBranchAndPayment({ date: 'invalid-date' })).rejects.toMatchObject({
            message: 'Invalid date format. Use YYYY-MM-DD',
            statusCode: 400
        });
    });
});


describe('chartService.getBookingTotalsByBranch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        requestContext.getOperatorId.mockReturnValue('operator-xyz');
    });

    it('aggregates totals for provided date without additional filters', async () => {
        Booking.aggregate.mockResolvedValue([
            { _id: { branchName: 'Hyderabad', paymentType: 'Paid' }, totalAmount: 2400 },
            { _id: { branchName: 'Hyderabad', paymentType: 'ToPay' }, totalAmount: 800 },
            { _id: { branchName: 'Vijayawada', paymentType: 'Paid' }, totalAmount: 1800 }
        ]);

        const result = await chartService.getBookingTotalsByBranch({ date: '2026-01-28' });

        expect(Booking.aggregate).toHaveBeenCalledWith([
            {
                $match: {
                    bookingDate: '2026-01-28',
                    operatorId: 'operator-xyz'
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
                        branchName: '$branch.name',
                        paymentType: '$lrType'
                    },
                    totalAmount: { $sum: { $ifNull: ['$totalAmountCharge', 0] } }
                }
            }
        ]);

        expect(result).toEqual([
            { branchName: 'Hyderabad', paid: 2400, toPay: 800, total: 3200 },
            { branchName: 'Vijayawada', paid: 1800, toPay: 0, total: 1800 }
        ]);
    });

    it('returns totals for provided date without applying branch filters', async () => {
        Booking.aggregate.mockResolvedValue([
            { _id: { branchName: 'Hyderabad', paymentType: 'Paid' }, totalAmount: 1000 }
        ]);

        const result = await chartService.getBookingTotalsByBranch({ date: '2026-02-01' });

        expect(Booking.aggregate).toHaveBeenCalledWith([
            {
                $match: {
                    bookingDate: '2026-02-01',
                    operatorId: 'operator-xyz'
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
                    _id: { branchName: '$branch.name', paymentType: '$lrType' },
                    totalAmount: { $sum: { $ifNull: ['$totalAmountCharge', 0] } }
                }
            }
        ]);

        expect(result).toEqual([
            { branchName: 'Hyderabad', paid: 1000, toPay: 0, total: 1000 }
        ]);
    });
});


describe('chartService.getBookingTotalsByUser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        requestContext.getOperatorId.mockReturnValue('operator-xyz');
    });

    it('aggregates totals per user for given date', async () => {
        Booking.aggregate.mockResolvedValue([
            { _id: { userName: 'John', paymentType: 'Paid' }, totalAmount: 1400 },
            { _id: { userName: 'John', paymentType: 'ToPay' }, totalAmount: 300 },
            { _id: { userName: 'Jane', paymentType: 'Paid' }, totalAmount: 900 }
        ]);

        const result = await chartService.getBookingTotalsByUser({ date: '2026-03-01' });

        expect(Booking.aggregate).toHaveBeenCalledWith([
            { $match: { bookingDate: '2026-03-01', operatorId: 'operator-xyz' } },
            { $match: { bookedBy: { $ne: null } } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'bookedBy',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $group: {
                    _id: { userName: '$user.fullName', paymentType: '$lrType' },
                    totalAmount: { $sum: { $ifNull: ['$totalAmountCharge', 0] } }
                }
            }
        ]);

        expect(result).toEqual([
            { userName: 'Jane', paid: 900, toPay: 0, total: 900 },
            { userName: 'John', paid: 1400, toPay: 300, total: 1700 }
        ]);
    });

    it('applies userName and bookingType filters', async () => {
        Booking.aggregate.mockResolvedValue([
            { _id: { userName: 'John', paymentType: 'Paid' }, totalAmount: 500 }
        ]);

        const result = await chartService.getBookingTotalsByUser({
            userName: 'john',
            bookingType: 'paid',
            date: '2026-03-02'
        });

        expect(Booking.aggregate).toHaveBeenCalledWith([
            { $match: { bookingDate: '2026-03-02', operatorId: 'operator-xyz', lrType: 'Paid' } },
            { $match: { bookedBy: { $ne: null } } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'bookedBy',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            { $match: { 'user.fullName': { $regex: 'john', $options: 'i' } } },
            {
                $group: {
                    _id: { userName: '$user.fullName', paymentType: '$lrType' },
                    totalAmount: { $sum: { $ifNull: ['$totalAmountCharge', 0] } }
                }
            }
        ]);

        expect(result).toEqual([
            { userName: 'John', paid: 500, toPay: 0, total: 500 }
        ]);
    });

    it('rejects invalid date input', async () => {
        await expect(chartService.getBookingTotalsByUser({ date: 'not-a-date' })).rejects.toMatchObject({
            message: 'Invalid date format. Use YYYY-MM-DD',
            statusCode: 400
        });
    });
});
