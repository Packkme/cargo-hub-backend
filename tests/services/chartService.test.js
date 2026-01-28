jest.mock('../../models/Booking', () => ({
    aggregate: jest.fn()
}));

jest.mock('../../utils/requestContext', () => ({
    getOperatorId: jest.fn()
}));

const Booking = require('../../models/Booking');
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

        const today = new Date().toISOString().split('T')[0];
        const result = await chartService.getTodayBookingsByPayment();

        expect(Booking.aggregate).toHaveBeenCalledWith([
            {
                $match: {
                    bookingDate: today,
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

        const result = await chartService.getTodayBookingsByPayment();

        expect(result).toEqual([
            { label: 'To Pay', value: 900 },
            { label: 'Paid', value: 0 }
        ]);
    });
});
