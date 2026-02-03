const mongoose = require('mongoose');
const { connect, closeDatabase, clearDatabase } = require('../testHelpers');

const Operator = require('../../models/Operator');
const OperatorService = require('../../services/OperatorService');

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await closeDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

describe('OperatorService.createOperator()', () => {
  const baseData = {
    name: 'Whizzarddd',
    code: 'wiz',
    address: 'Bangalore',
    phone: '0123456789',
    paymentOptions: ['Cash', 'UPI']
  };

  it('should create an operator and convert code to uppercase', async () => {
    const result = await OperatorService.createOperator(baseData);
    expect(result).toHaveProperty('_id');
    expect(result.code).toBe('WIZ');
    expect(result.name).toBe('Whizzarddd');
  });

  it('should throw error if code is less than 3 chars', async () => {
    const invalid = { ...baseData, code: 'W1' };
    await expect(OperatorService.createOperator(invalid))
      .rejects
      .toThrow(/Code must be exactly 3 characters/);
  });

  it('should throw error if code has no letter', async () => {
    const invalid = { ...baseData, code: '123' };
    await expect(OperatorService.createOperator(invalid))
      .rejects
      .toThrow(/Code must contain at least one uppercase letter/);
  });

  it('should throw error for duplicate code', async () => {
    await OperatorService.createOperator(baseData);
    await expect(OperatorService.createOperator({ ...baseData, name: 'NewName' }))
      .rejects
      .toThrow(/Code already exists/);
  });

  it('should throw error for duplicate name', async () => {
    await OperatorService.createOperator(baseData);
    await expect(OperatorService.createOperator({ ...baseData, code: 'ABC' }))
      .rejects
      .toThrow(/Operator with this name already exists/);
  });

  it('should throw error for invalid payment option', async () => {
    const invalid = { ...baseData, paymentOptions: ['paypal'] };
    await expect(OperatorService.createOperator(invalid))
      .rejects
      .toThrow(/Payment options must include at least one valid option/);
  });

  it('should accept valid GST and PAN numbers', async () => {
    const valid = {
      ...baseData,
      gstNumber: '27ABCDE1234F1Z5',
      panNumber: 'ABCDE1234F'
    };
    const result = await OperatorService.createOperator(valid);
    expect(result.gstNumber).toBe(valid.gstNumber);
    expect(result.panNumber).toBe(valid.panNumber);
  });

  it('should throw error for invalid GST number', async () => {
    const invalid = { ...baseData, gstNumber: 'INVALIDGST' };
    await expect(OperatorService.createOperator(invalid))
      .rejects
      .toThrow(/Invalid GST number format/);
  });

  it('should throw error for invalid PAN number', async () => {
    const invalid = { ...baseData, panNumber: '1234INVALID' };
    await expect(OperatorService.createOperator(invalid))
      .rejects
      .toThrow(/Invalid PAN number format/);
  });
});
