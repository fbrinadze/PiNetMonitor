module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/**/*.test.js',
    '!**/node_modules/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.property.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/client/'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(lowdb)/)'
  ],
  verbose: true,
  testTimeout: 10000
};
