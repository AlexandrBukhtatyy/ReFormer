import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * Границы слоёв проверяются линтером, а не соглашением.
 *
 * Правило «Host не знает про формы», которое держится на дисциплине, продержится до первого
 * дедлайна. Здесь оно становится ошибкой сборки. Прецедент в монорепо есть: у @reformer/mcp
 * отсутствие node-глобалов в ядре проверяется отдельной командой.
 *
 * Слои и что кому можно:
 *   host/     платформа            → только host/ и внешние библиотеки
 *   sdk/      поверхность плагина  → только типы из host/
 *   lib/      чистый домен         → только lib/ и внешние
 *   plugins/  предметная логика    → sdk/, lib/, свой каталог
 *   app/      композиция           → всё
 *
 * ОГРАНИЧЕНИЕ реализации: правила ловят импорты через псевдоним `@/…` и глубокие относительные
 * пути. Обход `../../` ровно на границе слоя они не видят — для этого нужен резолвер путей
 * (eslint-plugin-import с no-restricted-paths). Заводить зависимость до первого реального
 * нарушения не стали; если протечёт — добавим.
 */
const denyFromHost = [
  {
    group: ['@/lib/*', '@/lib'],
    message: 'Host не знает предметной логики: перенеси в plugins/ или обратись через сервис',
  },
  {
    group: ['@/plugins/*', '@/plugins'],
    message: 'Host не зависит от плагинов: это перевёрнутая зависимость',
  },
  { group: ['@/app/*', '@/app'], message: 'Host не зависит от композиции' },
];

const denyFromLib = [
  {
    group: ['@/host/*', '@/host'],
    message: 'Домен обязан оставаться переносимым: не импортируй платформу',
  },
  { group: ['@/plugins/*', '@/plugins'], message: 'Домен не зависит от плагинов' },
  { group: ['@/app/*', '@/app'], message: 'Домен не зависит от композиции' },
];

const denyFromPlugins = [
  { group: ['@/host/*', '@/host'], message: 'Плагин видит платформу только через @/sdk' },
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
    files: ['src/host/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: denyFromHost }] },
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
