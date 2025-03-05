export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/dist/tests/**/*.test.js'],
  moduleNameMapper: {
    '^molvis/core/(.*)$': '<rootDir>/$1'
  }
};
