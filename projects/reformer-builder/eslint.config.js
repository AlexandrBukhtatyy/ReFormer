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
 * Слои и что кому можно:
 *   shell/platform/  платформа            → только shell/platform/ и внешние библиотеки
 *   sdk/             поверхность плагина  → только типы из shell/platform/
 *   lib/             чистый домен         → только lib/ и внешние
 *   plugins/         предметная логика    → sdk/, lib/, свой каталог
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
    group: ['@/lib/*', '@/lib'],
    message: 'Платформа не знает предметной логики: перенеси в plugins/ или обратись через сервис',
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

const denyFromLib = [
  {
    group: ['@/shell/*', '@/shell'],
    message: 'Домен обязан оставаться переносимым: не импортируй оболочку',
  },
  { group: ['@/plugins/*', '@/plugins'], message: 'Домен не зависит от плагинов' },
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
  { group: ['@/shell/*', '@/shell'], message: 'Плагин видит платформу только через @/sdk' },
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
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: denyFromLib }] },
  },
  {
    files: ['src/plugins/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: denyFromPlugins }] },
  },
  {
    // `application/` — композиция, и ей можно всё: `@/shell`, `@/plugins`, `@/lib`, `@/sdk`.
    // Зона объявлена ЯВНО, хотя запретов у неё нет: отсутствие блока читалось бы как «про этот
    // каталог забыли», а не как решение. Ровно тот же набор прав, что у `shell/boot`, — разница
    // между ними не в правах, а в направлении зависимости.
    files: ['src/application/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
