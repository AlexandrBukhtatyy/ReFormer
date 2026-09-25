import { readdirSync } from 'node:fs';
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
 * код домена — его ядро `plugins/<домен>/core`; нейтральные помощники печати —
 * `@reformer/builder-toolkit`):
 *   shell/platform/        платформа          → только shell/platform/ и внешние библиотеки
 *   plugins/<домен>/core/  ядро домена        → контракт плагина и библиотеки; без React
 *   plugins/<домен>/<п>/   плагин             → контракт плагина, ядро СВОЕГО домена, свой каталог
 *   shell/boot/            сборка оболочки    → всё, КРОМЕ состава приложения и ядер доменов
 *   application/           состав приложения  → всё
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
    // Ядра доменов — тоже `@/plugins`: формат схемы, каталог и печать модуля формы приходят
    // к платформе только вкладами плагинов и службами.
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

/**
 * Оболочка не знает ДОМЕНА.
 *
 * Домен (стек) — набор плагинов со своим форматом схемы, редактором, превью и кодогеном. Всё,
 * что ему нужно от оболочки, он берёт возможностями (`reformer.workspace.models`,
 * `reformer.modules`, словарь оболочки), а не портами, которые собирает `boot`: иначе оболочка
 * собирала бы порты для всех доменов сразу. Импорт ядра домена из `shell/**` — ровно такой порт
 * в зародыше. Плагины домена (`@/plugins/<домен>/<плагин>`) стережёт храповик в тесте состава:
 * их список выводится из профиля `builder.base`, а не пишется здесь руками.
 */
const denyDomainCore = [
  {
    group: ['@/plugins/*/core', '@/plugins/*/core/**'],
    message: 'Оболочка не знает ядра домена: возьми механизм возможностью, а формат оставь плагину',
  },
];

/** Домены — каталоги `src/plugins/*`: новый домен получает свои правила без правки этого файла. */
const DOMAINS = readdirSync(new URL('./src/plugins', import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/**
 * Из `@/plugins` коду домена видно только ядро СВОЕГО домена: соседний плагин и чужой домен —
 * через SDK (точки расширения, возможности), иначе их нельзя ни выключить, ни заменить.
 *
 * Регулярное выражение, а не группа: gitignore-группа не умеет вернуть потомка запрещённого
 * каталога — `!@/plugins/reformer/core` не отменяет `@/plugins/*`.
 */
const denyForeignPlugins = (domain) => ({
  regex: `^@/plugins(?!/${domain}/core(?:/|$))(?:/|$)`,
  message: `Из @/plugins домену «${domain}» видно только своё ядро (@/plugins/${domain}/core): соседние плагины и чужие домены — через SDK`,
});

const denyFromPlugins = (domain) => [
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
  denyForeignPlugins(domain),
  { group: ['../../../**'], message: 'Глубокий относительный путь выходит за границу плагина' },
];

/**
 * Ядро домена — чистый предметный код: формат, операции, проверки, печать. Его делят плагины
 * домена, а интерфейс и связь с платформой — их работа: поэтому без React, оболочки и состава.
 * SDK можно — чистые функции контракта кита (`toDescriptor`, `exportNameFor`) и типы.
 */
const denyFromCore = (domain) => [
  ...denyFromPlugins(domain),
  {
    group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
    message: 'Ядро домена без React: интерфейс — работа плагинов домена',
  },
  {
    group: ['@/application/*', '@/application'],
    message: 'Ядро домена не знает состава приложения',
  },
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
    rules: {
      'no-restricted-imports': ['error', { patterns: [...denyDomainCore, ...denyApplication] }],
    },
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
  // Плагины и ядро — по домену: список `patterns` у каждого домена свой (своё ядро открыто).
  // Блок ядра стоит ПОСЛЕ блока домена и вытесняет его для `core/**` целиком — поэтому
  // `denyFromCore` включает запреты плагина, а не только свои.
  ...DOMAINS.flatMap((domain) => [
    {
      files: [`src/plugins/${domain}/**/*.{ts,tsx}`],
      rules: { 'no-restricted-imports': ['error', { patterns: denyFromPlugins(domain) }] },
    },
    {
      files: [`src/plugins/${domain}/core/**/*.{ts,tsx}`],
      rules: { 'no-restricted-imports': ['error', { patterns: denyFromCore(domain) }] },
    },
  ]),
  {
    // `application/` — композиция, и ей можно всё: `@/shell`, `@/plugins` с ядрами доменов
    // и оба входа пакета контракта плагинов.
    // Зона объявлена ЯВНО, хотя запретов у неё нет: отсутствие блока читалось бы как «про этот
    // каталог забыли», а не как решение. Ровно тот же набор прав, что у `shell/boot`, — разница
    // между ними не в правах, а в направлении зависимости.
    files: ['src/application/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
