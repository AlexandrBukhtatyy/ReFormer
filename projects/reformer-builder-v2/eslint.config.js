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
 *   shell/boot/      композиция           → всё
 *
 * ОГРАНИЧЕНИЕ реализации: правила ловят импорты через псевдоним `@/…` и глубокие относительные
 * пути — поэтому импорты, пересекающие границы подсистем, ОБЯЗАНЫ писаться через `@/…`
 * (соседей внутри каталога импортируем как './x'). После правки этого файла — проверка
 * пробником: временно внести нарушение, увидеть ошибку, удалить (см. decisions-log, t0-2:
 * при нуле нарушений забытая группа паттернов умирает бесшумно). Границы валит только
 * workspace-level прогон: `npm run lint --workspace reformer-builder-v2`.
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
    files: ['src/shell/platform/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: denyFromPlatform }] },
  },
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: denyFromLib }] },
  },
  {
    files: ['src/plugins/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: denyFromPlugins }] },
  },
]);
