const skipMongo = process.env.JEST_SKIP_MONGO === 'true';
const skipCoverage = skipMongo || process.env.JEST_SKIP_COVERAGE === 'true';

module.exports = {
  testEnvironment: '<rootDir>/tests/CustomNodeEnvironment.js',
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
  verbose: true,
  collectCoverage: !skipCoverage,
  detectOpenHandles: true,
  forceExit: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'services/**/*.js',
    'models/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js',
    'controllers/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**', 
    '!**/testHelpers.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  coverageThreshold: skipCoverage ? undefined : {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
};
