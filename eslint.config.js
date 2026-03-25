import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['**/dist', '**/node_modules', '**/coverage']),
  {
    files: ['**/*.{js,ts,jsx,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      // Disable react/no-unescaped-entities as it conflicts with JSX attributes
      'react/no-unescaped-entities': 'off',
    },
  },
]);
