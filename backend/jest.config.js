/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022'],
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          experimentalDecorators: true,
          types: ['jest', 'node'],
          skipLibCheck: true
        },
        diagnostics: {
          ignoreCodes: [2823] // Ignore import attributes error
        }
      }
    ]
  },
  testPathIgnorePatterns: ['dist/', 'node_modules/', 'artifacts/'],
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 30000, // 30 seconds for async operations
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  clearMocks: true
}
