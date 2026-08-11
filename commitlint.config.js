export default {
  extends: ['@commitlint/config-conventional'],
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
        'react-playground',
        'react-playground-e2e',
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
  },
};
