import { refsTrailer } from './scripts/commitlint/refs-trailer.mjs';

export default {
  extends: ['@commitlint/config-conventional'],
  // Локальные правила репозитория. Объект плагина commitlint принимает напрямую, без пакета.
  plugins: [{ rules: { 'refs-trailer': refsTrailer } }],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'reformer',
        'reformer-renderer-react',
        'reformer-renderer-json',
        'reformer-form-registry',
        'reformer-cdk',
        'reformer-ui-kit',
        'reformer-mcp',
        'reformer-builder',
        'reformer-builder-plugin-api',
        'reformer-builder-plugin-cli',
        'reformer-builder-toolkit',
        // Кит HexaUI — внешний плагин билдера, пакет в каталоге плагинов проекта-образца
        // (projects/reformer-builder-playground/.ui_builder/plugins/kit-hexa-ui), в npm не публикуется.
        'reformer-hexa-ui',
        // Тема RJSF из кита (packages/rjsf-kit-theme) — рантайм домена rjsf билдера, пока приватный.
        'rjsf-kit-theme',
        'react-playground',
        'react-playground-e2e',
        // Проект-образец, который билдер открывает как рабочий каталог, и e2e билдера на нём.
        'reformer-builder-playground',
        'reformer-builder-playground-e2e',
        'docs',
        'ci',
        'deps',
        // Корневой tooling: конфиги, хуки, скрипты — не принадлежит ни одному пакету.
        'repo',
        // Синхронизация трекера задач (.beads/**). Пакетов не касается — релиз не триггерит.
        'beads',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    // Третья, необязательная секция — ссылки на задачи: «Refs: <задача>, <затронутые…>»
    // и «Closes: #N» последним абзацем. Формат и причины — в scripts/commitlint/refs-trailer.mjs.
    'refs-trailer': [2, 'always'],
  },
};
