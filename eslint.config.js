import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * Границы слоёв `@reformer/core` — используются в двух блоках ниже.
 *
 * `allowTypeImports` намеренный: `form/types/` описывает компонент поля через
 * `ComponentType`/`ElementType`; они стираются при компиляции и рантайма не тянут.
 */
const REACT_MESSAGE =
  'Рантайм-зависимость от React живёт только в src/platforms/**. Слои state и form ' +
  'платформо-независимы: новый хук или подписку добавляйте в platforms/react. Type-only ' +
  'импорт (import type { ComponentType }) разрешён — он стирается при компиляции.';

/**
 * Пакеты React перечислены через `paths` (точное совпадение спецификатора), а НЕ через
 * `patterns`: в `patterns` действует gitignore-синтаксис, где `react` матчит ЛЮБОЙ сегмент
 * пути — запрет ложно срабатывал бы на `../platforms/react/index` с неверным сообщением.
 */
const NO_REACT_PATHS = [
  'react',
  'react-dom',
  'use-sync-external-store',
  'use-sync-external-store/shim',
].map((name) => ({ name, allowTypeImports: true, message: REACT_MESSAGE }));

const NO_PLATFORMS = {
  group: ['**/platforms/**', '**/platforms'],
  message:
    'Обратная зависимость слой→платформа запрещена: state и form не знают про биндинги. ' +
    'Сшивает их единственная точка — корневой src/index.ts.',
};

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

  // Node env для скриптов, CLI-launcher'ов и конфигов (включая вложенные в packages/projects)
  {
    files: [
      '**/scripts/**/*.{js,mjs,cjs}',
      '**/bin/**/*.{js,mjs,cjs}',
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

  // ─────────────────────────────────────────────────────────────────────────
  // Границы слоёв @reformer/core.
  //
  // 1. state ⇏ form (M1-модуляризация): state-субстрат (signals + модель + value-операции +
  //    producer-флаг + утилиты) НЕ импортирует form-слой. Обратное (form → state) разрешено.
  //    Держит слои расцепленными для subpath `@reformer/core/state`.
  // 2. state ⇏ react и form ⇏ react: рантайм-зависимость от React живёт только в
  //    src/platforms/**. Type-only импорты разрешены (см. NO_REACT_PATHS).
  // 3. state ⇏ platforms и form ⇏ platforms: обратной зависимости слой→платформа нет.
  //
  // ВАЖНО: новые паттерны для state/** дописываются В ЭТОТ блок. Отдельный блок с тем же
  // правилом для тех же файлов перезаписал бы его целиком — flat-config мержит по ключу
  // правила, а не по элементам patterns, и граница state⇏form исчезла бы молча.
  // ─────────────────────────────────────────────────────────────────────────
  {
    files: ['packages/reformer/src/signals.ts', 'packages/reformer/src/state/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/form/**', '**/form'],
              message:
                'Граница state⇏form: модуль state (src/state, src/signals) не импортирует form-слой ' +
                '(src/form/**: ноды/create-form/реестр/валидацию/схемы/DSL). Обратное направление ' +
                'form→state разрешено. state — строго реактивный: без форм/валидации/схем.',
            },
            NO_PLATFORMS,
          ],
          paths: NO_REACT_PATHS,
        },
      ],
    },
  },

  // form-слой: без рантайма React и без обратной зависимости на платформенные биндинги.
  {
    files: ['packages/reformer/src/form/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [NO_PLATFORMS], paths: NO_REACT_PATHS },
      ],
    },
  },
]);
