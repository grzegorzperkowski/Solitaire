import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  { ignores: ['.cache/**', 'dist/**', 'coverage/**', 'test-results/**', 'playwright-report/**', 'scripts/baselines/**'] },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'no-eval': 'error',
      'no-new-func': 'warn',
      'no-promise-executor-return': 'error',
      complexity: ['warn', 25],
      'max-depth': ['warn', 5],
    },
  },
  { files: ['src/**/*.js'], languageOptions: { globals: globals.browser } },
  { files: ['scripts/**/*.{js,mjs}', '*.config.js'], languageOptions: { globals: globals.node } },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    // Immediate planner doubles still implement the generator interface.
    rules: { 'require-yield': 'off' },
  },
  { files: ['src/ui/render.js'], languageOptions: { globals: { __BUILD_INFO__: 'readonly' } } },
]);
