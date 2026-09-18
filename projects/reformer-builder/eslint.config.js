import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * Границы слоёв проверяются линтером, а не соглашением.
 *
 * Правило «платформа не знает про формы», которое держится на дисциплине, продержится
 * до первого дедлайна. Здесь оно становится ошибкой сборки. Прецедент в монорепо есть:
 * у @reformer/mcp отсутствие node-глобалов в ядре проверяется отдельной командой.
 *
 * Слои и что кому можно (контракт плагина — пакет `@reformer/builder-plugin-api`; предметный
 * код стеков — пакеты `@reformer/builder-toolkit` и `@reformer/builder-stack-*` в `packages/`):
 *   shell/platform/  платформа            → только shell/platform/ и внешние библиотеки
 *   plugins/         предметная логика    → контракт плагина, пакеты стеков, свой каталог
 *   shell/boot/      сборка оболочки      → всё, КРОМЕ состава приложения
 *   application/     состав приложения    → всё
 *
 * ОГРАНИЧЕНИЕ реализации: правила ловят импорты через псевдоним `@/…` и глубокие относительные
 * пути — поэтому импорты, пересекающие границы подсистем, ОБЯЗАНЫ писаться через `@/…`
 * (соседей внутри каталога импортируем как './x'). После правки этого файла — проверка
 * пробником: временно внести нарушение, увидеть ошибку, удалить (см. decisions-log, t0-2:
 * при нуле нарушений забытая группа паттернов умирает бесшумно). Границы валит только
 * workspace-level прогон: `npm run lint --workspace @reformer/builder`.
 */
const denyFromPlatform = [
  {
    // Предметный код живёт пакетами стеков. Платформа их не знает: формат схемы, каталог
    // и печать модуля формы приходят к ней только вкладами плагинов и службами.
    group: ['@reformer/builder-stack-*'],
    message: 'Платформа не знает предметной логики стека: обратись через вклад или службу',
  },
  {
    group: ['@/plugins/*', '@/plugins'],
    message: 'Платформа не зависит от плагинов: это перевёрнутая зависимость',
  },
  {
    group: ['@/shell/boot/*', '@/shell/boot'],
    message: 'Платформа не зависит от композиции',
  },
];

/**
 * Оболочка не знает СОСТАВА приложения.
 *
 * `application/` объявляет, из каких плагинов собран ReFormer Builder, и зависимость идёт только
 * оттуда сюда: `boot` получает состав параметром (`BootOptions.application`), а форму этого
 * параметра объявляет сам (`shell/boot/composition`). Импорт в обратную сторону вернул бы список
 * плагинов в оболочку — то единственное, ради чего слой и заведён, — и притом молча: тип
 * скомпилировался бы, а значение приехало бы в стартовый граф со всеми шестью ленивыми.
 */
const denyApplication = [
  {
    group: ['@/application/*', '@/application'],
    message: 'Оболочка не знает состава приложения: состав приходит параметром в boot',
  },
];

const denyFromPlugins = [
  {
    group: ['@/shell/*', '@/shell'],
    message: 'Плагин видит платформу только через @reformer/builder-plugin-api',
  },
  {
    // Второй вход пакета — примитивы целиком, для оболочки. Встроенный плагин обязан обходиться
    // тем же, что внешний: иначе у «своих» появится поверхность, которой у чужих нет, и контракт
    // перестанет описывать то, чем встроенные на самом деле живут.
    group: ['@reformer/builder-plugin-api/internal'],
    message: 'Плагину — только контракт: @reformer/builder-plugin-api, без /internal',
  },
  {
    group: ['@/plugins/*', '@/plugins'],
    message: 'Плагины не импортируют друг друга: только сервисы, команды и события',
  },
  { group: ['../../../**'], message: 'Глубокий относительный путь выходит за границу плагина' },
];

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
  },
  {
    files: ['src/shell/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: denyApplication }] },
  },
  {
    // Платформе — и запреты слоя, и запрет состава. Списки СКЛЕЕНЫ намеренно: блоки flat-config
    // не складываются, и последний блок по одному и тому же правилу вытесняет предыдущий целиком.
    // Задай мы здесь только `denyFromPlatform`, платформа тихо потеряла бы запрет на `@/application`.
    files: ['src/shell/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...denyFromPlatform, ...denyApplication] }],
    },
  },
  {
    // Интеграционные тесты СБОРКИ — узаконенное исключение (см. project-structure, «Соглашения»):
    // они проверяют собранное приложение, то есть обязаны знать его состав. Запрет выше адресован
    // КОДУ оболочки, а не проверкам того, что из неё собирается. Каталог назван точечно: запретов
    // у него не было и до появления `application/`, поэтому «off» здесь ничего не ослабляет.
    files: ['src/shell/boot/integration/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/plugins/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: denyFromPlugins }] },
  },
  {
    // `application/` — композиция, и ей можно всё: `@/shell`, `@/plugins`, пакеты стеков
    // и оба входа пакета контракта плагинов.
    // Зона объявлена ЯВНО, хотя запретов у неё нет: отсутствие блока читалось бы как «про этот
    // каталог забыли», а не как решение. Ровно тот же набор прав, что у `shell/boot`, — разница
    // между ними не в правах, а в направлении зависимости.
    files: ['src/application/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
