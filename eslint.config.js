import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    '**/dist',
    '**/node_modules',
    '**/coverage',
    '**/build',
    '**/.docusaurus',
    '**/.tmp',
    '**/.playwright-mcp',
    // Auto-generated mock handlers (msw + vite-plugin-mock-server)
    '**/_generated/**',
    // Auto-generated API docs from JSDoc
    'projects/reformer-doc/docs/api/**',
  ]),

  // Базовая конфигурация для всего TS/JS
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'react/no-unescaped-entities': 'off',
      // ^_ префикс — соглашение проекта для intentionally-unused
      // (placeholder vars, ignored params, type parameters в declarations).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },

  // React hooks plugin — для всех TSX и для hooks/use* файлов
  {
    files: ['**/*.{jsx,tsx}', '**/hooks/**/*.{ts,tsx}', '**/use*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // refs-during-render: ref-capture pattern (submitRef.current = handler in body)
      // используется в playground v10 для stable closure-capture без zaшумления deps.
      // Idiomatic React pattern, выключаем глобально.
      'react-hooks/refs': 'off',
    },
  },

  // Node env для скриптов и конфигов (включая вложенные в packages/projects)
  {
    files: [
      '**/scripts/**/*.{js,mjs,cjs}',
      '**/*.config.{js,mjs,cjs,ts}',
      '**/.*rc.{js,mjs,cjs}',
      '**/vite.config.*',
      '**/vitest.config.*',
      '**/playwright.config.*',
      '**/postcss.config.*',
      '**/tailwind.config.*',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Browser env для frontend
  {
    files: ['projects/**/*.{ts,tsx,jsx}', 'packages/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // React plugin для Docusaurus-документации
  {
    files: ['projects/reformer-doc/**/*.{ts,tsx,jsx}'],
    plugins: { react },
    rules: {
      ...react.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
]);
