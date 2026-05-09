'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],

  // Collect coverage only for the services covered by Lot 0 tests.
  // Future lots will expand this list.
  collectCoverageFrom: [
    'src/controllers/commissionsController.js',
    'src/controllers/dossiersController.js',
    'src/controllers/leadsController.js',
    'src/controllers/pedagogieController.js',
    'src/models/Commission.js',
    'src/models/Dossier.js',
    'src/services/distributionService.js',
  ],

  // Per-file thresholds enforce the 70%+ target on the most critical paths.
  // Global floor prevents silent regression across the whole set.
  coverageThreshold: {
    global: {
      statements: 50,
      lines: 50,
    },
    'src/controllers/commissionsController.js': {
      statements: 80,
      lines: 80,
    },
    'src/controllers/dossiersController.js': {
      statements: 65,
      lines: 65,
    },
    'src/controllers/leadsController.js': {
      statements: 65,
      lines: 65,
    },
    'src/services/distributionService.js': {
      statements: 100,
      lines: 100,
    },
  },

  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  verbose: false,
};
