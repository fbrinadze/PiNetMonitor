export default {
  rootDir: '..',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/client/src/setupTests.js'],
  moduleDirectories: ['node_modules', 'client/node_modules'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/client/src/$1'
  },
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-react'] }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(socket.io-client)/)'
  ],
  collectCoverageFrom: [
    'client/src/**/*.{js,jsx}',
    '!client/src/**/*.test.{js,jsx}',
    '!client/src/setupTests.js',
    '!**/node_modules/**'
  ],
  testMatch: [
    '<rootDir>/tests/frontend/**/*.test.js',
    '<rootDir>/tests/frontend/**/*.test.jsx',
    '<rootDir>/tests/frontend/**/*.property.test.js',
    '<rootDir>/tests/frontend/**/*.property.test.jsx'
  ],
  verbose: true
};
