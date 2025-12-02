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
        'react-playground',
        'react-playground-e2e',
        'reformer-tutorial',
        'reformer-tutorial-ai',
        'docs',
        'ci',
        'deps',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
  },
};
