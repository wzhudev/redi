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
    "^@wendellhu/redi$": '<rootDir>/src/publicApi.ts',
    "^@wendellhu/redi/react-bindings$": '<rootDir>/src/react-bindings/publicApi.ts',
  },
  moduleDirectories: ['.', 'src', 'node_modules']
};
