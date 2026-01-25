// Mock the UserService before requiring the controller
jest.mock('../../services/UserService', () => ({
  getUserNameByOperator: jest.fn(),
}));

const userController = require('../../controllers/userController');
const UserService = require('../../services/UserService');
const AppError = require('../../utils/AppError');

describe('userController.getUserNames', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: {
        operatorId: '507f1f77bcf86cd799439011',
        role: { rolename: 'Super User' },
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  it('should return mapped users for Super User', async () => {
    const mockUsers = [
      {
        _id: { toString: () => '507f1f77bcf86cd799439012' },
        fullName: 'John Doe',
      },
      {
        _id: { toString: () => '507f1f77bcf86cd799439013' },
        fullName: 'Jane Smith',
      },
    ];

    UserService.getUserNameByOperator.mockResolvedValue(mockUsers);

    await userController.getUserNames(req, res, next);

    expect(UserService.getUserNameByOperator).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'Super User'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      status: 'success',
      data: {
        users: [
          { userId: '507f1f77bcf86cd799439012', userName: 'John Doe' },
          { userId: '507f1f77bcf86cd799439013', userName: 'Jane Smith' },
        ],
        count: 2,
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should deny access for non Super Users', async () => {
    req.user.role.rolename = 'Admin';

    await userController.getUserNames(req, res, next);

    expect(UserService.getUserNameByOperator).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
    expect(error.errorCode).toBe('FORBIDDEN');
    expect(error.message).toBe('You can only search users for your own operator');
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should pass service errors to next', async () => {
    const serviceError = new Error('Database connection failed');
    UserService.getUserNameByOperator.mockRejectedValue(serviceError);

    await userController.getUserNames(req, res, next);

    expect(next).toHaveBeenCalledWith(serviceError);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should handle empty responses gracefully', async () => {
    UserService.getUserNameByOperator.mockResolvedValue([]);

    await userController.getUserNames(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      status: 'success',
      data: {
        users: [],
        count: 0,
      },
    });
  });
});
