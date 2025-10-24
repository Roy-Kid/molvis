/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true }],
  },
  transformIgnorePatterns: ['/node_modules/'],
  rootDir: './',
  moduleNameMapper: {
    '@molvis/core': '<rootDir>/src/index.ts',
    '^@molvis/core/(.*)$': '<rootDir>/src/$1',
  },
};
