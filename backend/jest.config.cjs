/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],
  coverageDirectory: 'coverage',
  // Les suites d'intégration partagent des connexions singleton (Prisma,
  // Mongoose, Neo4j) : une fois le résumé affiché, on force la sortie du
  // process plutôt que d'attendre la fermeture de chaque keep-alive
  // (le job CI pendait 6 h sans ça).
  forceExit: true,
};
