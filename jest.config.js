module.exports = {
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    '**/src/**/*.{ts,tsx}'
  ],
  moduleNameMapper: {
    "^redi$": '<rootDir>/src/publicApi.ts',
    "^redi/react$": '<rootDir>/src/redi-react/publicApi.ts',
  },
  moduleDirectories: ['.', 'src', 'node_modules']
};
