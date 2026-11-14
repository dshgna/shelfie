import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

// src/domain holds pure rules: no UI, storage, network or app code. See src/domain/README.md.
const DOMAIN_RULES = 'src/domain/README.md'

const domainBannedPackages = [
  { regex: '^react(-dom)?(/|$)', message: `No React in src/domain. See ${DOMAIN_RULES}.` },
  {
    regex: '^react-aria-components(/|$)',
    message: `No UI components in src/domain. See ${DOMAIN_RULES}.`,
  },
  { regex: '^@supabase/', message: `No Supabase in src/domain. See ${DOMAIN_RULES}.` },
  {
    regex: '^@capacitor(-[\\w-]+)?/',
    message: `No Capacitor or Capacitor plugins in src/domain. See ${DOMAIN_RULES}.`,
  },
]

// ESLint only sees the import text, so "climbing out" depends on how deep the file is:
// '../x' leaves src/domain from src/domain/a.ts, but not from src/domain/swaps/a.ts.
// One block per folder depth (up to 3 levels below src/domain).
const domainImportBlocks = [1, 2, 3, 4].map((depth) => ({
  files: [`src/domain/${'*/'.repeat(depth - 1)}*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...domainBannedPackages,
          {
            regex: `^(\\.\\./){${depth},}`,
            message: `This relative import leaves src/domain. Domain code may only import from inside src/domain. See ${DOMAIN_RULES}.`,
          },
        ],
      },
    ],
  },
}))

const domainBannedGlobals = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'navigator',
  // Ways to reach any of the above indirectly (globalThis.fetch, self.localStorage).
  'globalThis',
  'self',
].map((name) => ({
  name,
  message: `No browser globals or network in src/domain: pass what you need in as a parameter. See ${DOMAIN_RULES}.`,
}))

// Rules must give the same answer every time, so the clock and randomness come in as parameters.
// new Date(someValue) stays allowed: it turns a value into a date without reading the clock.
const NOT_DETERMINISTIC = `Pass today in as a parameter, see ${DOMAIN_RULES}`
const domainBannedSyntax = [
  "NewExpression[callee.name='Date'][arguments.length=0]",
  "CallExpression[callee.object.name='Date'][callee.property.name='now']",
  "CallExpression[callee.object.name='Math'][callee.property.name='random']",
].map((selector) => ({ selector, message: NOT_DETERMINISTIC }))

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'prototype',
      'ios',
      'android',
      'playwright-report',
      'test-results',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  ...domainImportBlocks,
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...domainBannedGlobals],
      'no-restricted-syntax': ['error', ...domainBannedSyntax],
    },
  },
)
