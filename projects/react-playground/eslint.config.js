import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // `builder-ab/*/` — модули форм, напечатанные A/B-замером ассистента билдера: машинный вывод,
  // который каждый прогон перезаписывает. Их качество — предмет замера, а не линта витрины.
  globalIgnores(['dist', 'src/mocks/_generated', 'src/pages/debug/builder-ab/*/']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
]);
