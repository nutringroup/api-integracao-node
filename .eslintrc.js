module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    // Regras personalizadas para o projeto
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }],
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-spacing': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': 'error',
    'prefer-destructuring': ['error', {
      array: true,
      object: true
    }],
    'no-duplicate-imports': 'error',
    'no-useless-constructor': 'error',
    'no-useless-rename': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'comma-dangle': ['error', 'never'],
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    'indent': ['error', 2],
    'eol-last': 'error',
    'no-trailing-spaces': 'error',
    'no-multiple-empty-lines': ['error', { 
      max: 2, 
      maxEOF: 1,
      maxBOF: 0 
    }],
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }],
    'keyword-spacing': 'error',
    'space-infix-ops': 'error',
    'comma-spacing': 'error',
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'curly': ['error', 'multi-line'],
    'no-mixed-spaces-and-tabs': 'error',
    'no-tabs': 'error',
    'max-len': ['warn', { 
      code: 100,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true 
    }],
    'camelcase': ['error', { 
      properties: 'never',
      ignoreDestructuring: true,
      ignoreImports: true 
    }],
    'new-cap': ['error', { 
      newIsCap: true,
      capIsNew: false 
    }],
    'no-new-object': 'error',
    'no-array-constructor': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'radix': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-script-url': 'error',
    'no-proto': 'error',
    'no-iterator': 'error',
    'dot-notation': 'error',
    'one-var': ['error', 'never'],
    'no-multi-assign': 'error',
    'no-nested-ternary': 'error',
    'no-unneeded-ternary': 'error',
    'no-else-return': 'error',
    'consistent-return': 'error',
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'require-await': 'error',
    'no-await-in-loop': 'warn',
    'prefer-promise-reject-errors': 'error',
    'no-throw-literal': 'error',
    'handle-callback-err': 'error',
    'no-process-exit': 'error',
    'no-path-concat': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      rules: {
        'no-unused-expressions': 'off'
      }
    }
  ]
}; 