import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/**
 * Flat config — ESLint 9 no longer reads .eslintrc.js, which is the format the
 * E01-06 ticket was written against. Rules are unchanged from the ticket.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.d.ts',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'pnpm-lock.yaml',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // CommonJS config files: Node globals, and require() is the point.
  {
    files: ['**/*.cjs', '**/metro.config.js', '**/*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        exports: 'writable',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  // Seed and verification scripts are CLI tools; their output is the point.
  {
    files: ['apps/web/prisma/seed.ts', 'scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  // Must stay last: turns off every rule Prettier owns.
  prettier
)
