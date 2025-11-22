import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';
import prettierPlugin from 'eslint-plugin-prettier'; // <-- импорт через ESM
import reactHooks from 'eslint-plugin-react-hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: { extends: ['eslint:recommended'] },
});

export default [
  ...compat.extends('plugin:react/recommended'),
  ...compat.extends('plugin:@typescript-eslint/recommended'),
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/.docusaurus/**', '*.log'],
  },
  {
    plugins: {
      prettier: prettierPlugin, // подключаем плагин через import
      'react-hooks': reactHooks,
    },
    rules: {
      'prettier/prettier': 'error',
      'react/react-in-jsx-scope': 'off',
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
    files: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
  },
];
