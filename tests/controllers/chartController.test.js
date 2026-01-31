jest.mock('../../services/chartService', () => ({
  getBookingsByBranchAndPayment: jest.fn(),
  getBookingTotalsByBranch: jest.fn(),
  getBookingTotalsByUser: jest.fn()
}));

const chartController = require('../../controllers/chartController');
const chartService = require('../../services/chartService');

describe('chartController.getBookingsByBranchAndPayment', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: { date: '2026-02-01' } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it('returns branch overview data', async () => {
    const payload = [{ branchName: 'Hyderabad', paid: 10, toPay: 4 }];
    chartService.getBookingsByBranchAndPayment.mockResolvedValue(payload);

    await chartController.getBookingsByBranchAndPayment(req, res);

    expect(chartService.getBookingsByBranchAndPayment).toHaveBeenCalledWith({ date: '2026-02-01' });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: payload });
  });

  it('propagates service errors with status code', async () => {
    const error = new Error('bad');
    error.statusCode = 422;
    chartService.getBookingsByBranchAndPayment.mockRejectedValue(error);

    await chartController.getBookingsByBranchAndPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'bad' });
  });
});


describe('chartController.getBookingTotalsByBranch', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      query: {
        branchName: 'hyd',
        bookingType: 'paid',
        date: '2026-01-28'
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  it('returns service payload with default 200', async () => {
    const mockPayload = [{ branchName: 'Hyd', paid: 10, toPay: 2 }];
    chartService.getBookingTotalsByBranch.mockResolvedValue(mockPayload);

    await chartController.getBookingTotalsByBranch(req, res);

    expect(chartService.getBookingTotalsByBranch).toHaveBeenCalledWith({ date: req.query.date });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockPayload });
  });

  it('returns error payload with provided status code', async () => {
    const error = new Error('Invalid date');
    error.statusCode = 400;
    chartService.getBookingTotalsByBranch.mockRejectedValue(error);

    await chartController.getBookingTotalsByBranch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid date'
    });
  });

  it('falls back to 500 on unexpected error', async () => {
    const error = new Error('boom');
    chartService.getBookingTotalsByBranch.mockRejectedValue(error);

    await chartController.getBookingTotalsByBranch(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'boom'
    });
  });
});

describe('chartController.getBookingTotalsByUser', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: { userName: 'john', bookingType: 'paid', date: '2026-04-01' } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it('responds with service payload', async () => {
    const payload = [{ userName: 'Ramesh', paid: 14, toPay: 3, total: 17 }];
    chartService.getBookingTotalsByUser.mockResolvedValue(payload);

    await chartController.getBookingTotalsByUser(req, res);

    expect(chartService.getBookingTotalsByUser).toHaveBeenCalledWith(req.query);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: payload });
  });

  it('handles service errors with status code', async () => {
    const error = new Error('bad');
    error.statusCode = 422;
    chartService.getBookingTotalsByUser.mockRejectedValue(error);

    await chartController.getBookingTotalsByUser(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'bad' });
  });
});
