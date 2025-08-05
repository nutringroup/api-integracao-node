module.exports = {
  // Ambiente de teste
  testEnvironment: 'node',

  // Diretórios de teste
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],

  // Arquivos a serem ignorados
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/logs/'
  ],

  // Configuração de cobertura
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/workers/index.js',
    '!src/config/logger.js',
    '!**/node_modules/**',
    '!**/logs/**'
  ],

  // Diretório de saída da cobertura
  coverageDirectory: 'coverage',

  // Formatos de relatório de cobertura
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'clover'
  ],

  // Limites de cobertura
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Setup antes dos testes
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Timeout para testes
  testTimeout: 30000,

  // Configuração de módulos
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@jobs/(.*)$': '<rootDir>/src/jobs/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },

  // Configuração de transformação
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Configuração de ambiente
  setupFiles: ['<rootDir>/tests/env.js'],

  // Verbose para saída detalhada
  verbose: true,

  // Detectar arquivos abertos
  detectOpenHandles: true,

  // Forçar saída após testes
  forceExit: true,

  // Configuração de globals
  globals: {
    NODE_ENV: 'test'
  },

  // Configuração de mock
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
}; 