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
  'Зависимость от React живёт только в src/platforms/** и отдаётся входом @reformer/core/react. ' +
  'Слои model, form и i18n платформо-независимы и в рантайме, и в типах: новый хук или подписку ' +
  'добавляйте в platforms/react, а компонент узла схемы типизируйте как ComponentRef.';

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
].map((name) => ({ name, allowTypeImports: false, message: REACT_MESSAGE }));

const NO_PLATFORMS = {
  group: ['**/platforms/**', '**/platforms'],
  message:
    'Обратная зависимость слой→платформа запрещена: model, form и i18n не знают про биндинги. ' +
    'Платформу отдаёт единственный вход — src/react.ts (@reformer/core/react).',
};

/**
 * Домены-плагины проекта-образца билдера: `.ui_builder/plugins/<домен>/{core,<плагин>}`.
 *
 * Пока домены жили внутри билдера, их границы стерёг его eslint.config.js по псевдониму
 * `@/plugins/…`. Пакетами они ходят к ядру относительным путём, и стеречь приходится путь:
 *
 *   плагин → контракт (`@reformer/builder-plugin-api`, без `/internal`), ядро СВОЕГО домена, свой src/
 *   ядро   → то же и без React: интерфейс — работа плагинов домена
 *
 * Сосед по домену достижим только через точки расширения и возможности: иначе его нельзя
 * ни выключить, ни заменить, а сборка каждого плагина вложила бы в себя копию соседа.
 * Каталог `integration/` под правило не попадает намеренно: он проверяет собранное приложение
 * и обязан знать и оболочку (`@/…`), и все плагины домена сразу.
 */
const DOMAIN_PLUGINS = 'projects/reformer-builder-playground/.ui_builder/plugins/*';

const DOMAIN_PLUGIN_BOUNDARY = [
  {
    regex: '^@/',
    message:
      'Плагин проекта не видит исходников билдера: платформа доступна только через ' +
      '@reformer/builder-plugin-api',
  },
  {
    // Второй вход пакета — примитивы целиком, для оболочки. Плагин обязан обходиться контрактом:
    // иначе его сборка зависела бы от того, чего у стороннего автора плагина нет.
    regex: '^@reformer/builder-plugin-api/internal$',
    message: 'Плагину — только контракт: @reformer/builder-plugin-api, без /internal',
  },
  {
    // Выход из своего пакета вверх и вход в `src/` другого — это сосед по домену. Ядро лежит
    // без `src/` (`../../core/…`), общие помощники тестов — в `.shared`: под шаблон не попадают.
    regex: '^(?:\\.\\./)+(?:[^./][^/]*/src|integration)(?:/|$)',
    message:
      'Соседний плагин домена — только через SDK (точки расширения, возможности); общий ' +
      'предметный код кладите в ядро домена (core/)',
  },
];

/**
 * Через `paths`, а не `patterns`: в `patterns` действует gitignore-синтаксис, где `react`
 * совпадает с ЛЮБЫМ сегментом пути (см. NO_REACT_PATHS выше).
 */
const DOMAIN_CORE_NO_REACT = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'].map(
  (name) => ({ name, message: 'Ядро домена без React: интерфейс — работа плагинов домена' })
);

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
    // Сборка клиента @reformer/builder для публикации (`npm run build:client`): рядом с `dist`,
    // в git не едет, исключена .gitignore пакета, которого ESLint не читает
    'projects/reformer-builder/client',
    // Сборка плагинов проекта-образца для билдера: main.js в корне каталога плагина (у кита
    // HexaUI — 4 МБ, у плагина ИИ — 8). В git не едет, но исключена вложенным .gitignore, которого
    // ESLint не читает. Плагин лежит прямо в каталоге плагинов или в каталоге домена — два уровня
    'projects/reformer-builder-playground/.ui_builder/plugins/*/main.js',
    'projects/reformer-builder-playground/.ui_builder/plugins/*/*/main.js',
    // Модули данных той же сборки — JSON, импортируемый отложенно (мегабайты корпуса знаний)
    'projects/reformer-builder-playground/.ui_builder/plugins/*/chunks',
    'projects/reformer-builder-playground/.ui_builder/plugins/*/*/chunks',
    // Корпус знаний плагина ИИ — выход генератора (`npm run generate:knowledge`)
    'projects/reformer-builder-playground/.ui_builder/plugins/reformer/ai/src/knowledge/generated',
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
      // Харнесс eval'а — такой же node-скрипт: поднимает MCP-сервер как дочерний процесс
      // и печатает отчёт. Живёт рядом с пакетом (packages/*/eval/), а не в scripts/.
      '**/eval/**/*.{js,mjs,cjs}',
      '**/bin/**/*.{js,mjs,cjs}',
      // Плагин dev-сервера, которым билдер встраивается в приложение: его грузит конфиг сборки.
      'projects/reformer-builder/vite/**/*.mjs',
      // Общие скрипты сборки плагинов проекта-образца (генератор их таблиц стилей): запускаются
      // node'ом из каталога пакета плагина, а не исполняются в браузере.
      'projects/reformer-builder-playground/.ui_builder/plugins/.shared/**/*.mjs',
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
  // 1. model ⇏ form (M1-модуляризация): реактивный субстрат (signals + модель + value-операции +
  //    producer-флаг + утилиты) НЕ импортирует form-слой. Обратное (form → model) разрешено.
  //    Держит слои расцепленными для subpath `@reformer/core/model`.
  // 2. model ⇏ react и form ⇏ react: зависимость от React живёт только в src/platforms/**.
  //    Type-only импорты запрещены тоже (см. NO_REACT_PATHS): типы схемы не тянут типы React.
  // 3. model ⇏ platforms и form ⇏ platforms: обратной зависимости слой→платформа нет.
  // 4. Корневой вход и вход i18n ⇏ platforms: React отдаёт только src/react.ts.
  //
  // ВАЖНО: новые паттерны для model/** дописываются В ЭТОТ блок. Отдельный блок с тем же
  // правилом для тех же файлов перезаписал бы его целиком — flat-config мержит по ключу
  // правила, а не по элементам patterns, и граница model⇏form исчезла бы молча.
  // ─────────────────────────────────────────────────────────────────────────
  {
    files: ['packages/reformer/src/signals.ts', 'packages/reformer/src/model/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/form/**', '**/form'],
              message:
                'Граница model⇏form: модуль model (src/model, src/signals) не импортирует form-слой ' +
                '(src/form/**: ноды/create-form/реестр/валидацию/схемы/DSL). Обратное направление ' +
                'form→model разрешено. model — строго реактивный: без форм/валидации/схем.',
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

  // Реестр «ручка модели → нода формы»: заполняет сборка, читают валидация (разнос замечаний) и
  // поведение (state-операции). Уровень формы, отправка и поток шагов нод не касаются — им ноды
  // достаются через раннер валидации.
  //
  // ВАЖНО: NO_PLATFORMS и NO_REACT_PATHS повторены здесь намеренно. Flat-config мержит по ключу
  // правила, а не по элементам patterns: без них этот блок молча снял бы для своих файлов запреты
  // блока form/** выше.
  {
    files: [
      'packages/reformer/src/form/form-level.ts',
      'packages/reformer/src/form/submission.ts',
      'packages/reformer/src/form/flow/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/signal-node-registry'],
              message:
                'Реестр «ручка → нода» заполняет сборка, читают валидация и поведение. Уровень ' +
                'формы, отправка и поток нод не касаются: касание и замечания — опции раннера ' +
                '(`runAndApply(…, { touch })`, `controller.run({ touch })`).',
            },
            NO_PLATFORMS,
          ],
          paths: NO_REACT_PATHS,
        },
      ],
    },
  },

  // i18n-слой и встроенные локали: данные и чистые функции, без React и без платформенных
  // биндингов. React-привязка (контекст, провайдер, хуки) лежит в src/platforms/react/i18n
  // и отдаётся входом src/react.ts.
  //
  // Сюда же — корневой вход и вход i18n: они собирают слои и обязаны оставаться без React,
  // иначе `import '@reformer/core'` снова потянет его на сервере.
  {
    files: [
      'packages/reformer/src/i18n/**/*.ts',
      'packages/reformer/src/locale/**/*.ts',
      'packages/reformer/src/index.ts',
      'packages/reformer/src/i18n.ts',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [NO_PLATFORMS], paths: NO_REACT_PATHS },
      ],
    },
  },

  // Границы доменов-плагинов проекта-образца билдера — см. DOMAIN_PLUGIN_BOUNDARY.
  {
    files: [`${DOMAIN_PLUGINS}/*/src/**/*.{ts,tsx}`],
    rules: { 'no-restricted-imports': ['error', { patterns: DOMAIN_PLUGIN_BOUNDARY }] },
  },
  {
    files: [`${DOMAIN_PLUGINS}/core/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: DOMAIN_PLUGIN_BOUNDARY, paths: DOMAIN_CORE_NO_REACT },
      ],
    },
  },
]);
