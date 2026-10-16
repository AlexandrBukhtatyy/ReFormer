import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idleVerdict, listArgs, missingFiles, reportedFiles } from './run-vitest-verdict.mjs';

const CORE_FILE = ' ✓ tests/core/production-mode.test.ts (6 tests) 840ms';
const BROWSER_FILE =
  ' ✓  browser (chromium)  src/shell/ui/MergeDialog.browser.test.tsx (6 tests) 1125ms';
const SUMMARY = ' Test Files  2 passed (2)\n      Tests  12 passed (12)';

test('reportedFiles: строки файлов с меткой проекта и без, вложенные строки тестов — мимо', () => {
  const output = [
    CORE_FILE,
    BROWSER_FILE,
    '     ✓ нижняя панель встаёт без отказа раскладки  369ms',
    ' ❯ tests/broken.test.ts (3 tests | 1 failed) 20ms',
    '\x1b[32m ✓\x1b[39m tests/colored.test.ts (1 test) 5ms',
  ].join('\n');
  assert.deepEqual(reportedFiles(output), [
    { project: '', path: 'tests/core/production-mode.test.ts' },
    { project: 'browser (chromium)', path: 'src/shell/ui/MergeDialog.browser.test.tsx' },
    { project: '', path: 'tests/broken.test.ts' },
    { project: '', path: 'tests/colored.test.ts' },
  ]);
});

test('missingFiles: сверка по окончанию пути и по проекту, если он есть с обеих сторон', () => {
  const expected = [
    { file: 'D:/repo/pkg/tests/core/production-mode.test.ts' },
    {
      file: 'D:\\repo\\pkg\\src\\shell\\ui\\MergeDialog.browser.test.tsx',
      projectName: 'browser (chromium)',
    },
    { file: 'D:/repo/pkg/src/shell/Shell.browser.test.tsx', projectName: 'browser (chromium)' },
  ];
  const missing = missingFiles(expected, reportedFiles(`${CORE_FILE}\n${BROWSER_FILE}`));
  assert.deepEqual(
    missing.map((m) => m.file),
    ['D:/repo/pkg/src/shell/Shell.browser.test.tsx']
  );
  // Тот же путь в другом проекте не засчитывается.
  assert.equal(
    missingFiles(
      [{ file: 'D:/repo/pkg/src/shell/ui/MergeDialog.browser.test.tsx', projectName: 'firefox' }],
      reportedFiles(BROWSER_FILE)
    ).length,
    1
  );
});

test('idleVerdict: падения в выводе — неуспех даже при итоге', () => {
  const output = `${CORE_FILE}\n Test Files  1 failed | 1 passed (2)`;
  assert.equal(idleVerdict({ output, coverage: false, expected: undefined }).code, 1);
});

test('idleVerdict: итог напечатан — успех без сверки со списком', () => {
  const output = `${CORE_FILE}\n${BROWSER_FILE}\n${SUMMARY}`;
  assert.equal(idleVerdict({ output, coverage: false, expected: undefined }).code, 0);
});

test('idleVerdict: итога нет и файл не отчитался — неуспех с именем файла (ReFormer-rchr)', () => {
  const verdict = idleVerdict({
    output: `${CORE_FILE}\n${BROWSER_FILE}`,
    coverage: false,
    expected: [
      { file: 'D:/repo/pkg/tests/core/production-mode.test.ts' },
      { file: 'D:/repo/pkg/src/shell/ui/MergeDialog.browser.test.tsx' },
      { file: 'D:/repo/pkg/src/shell/Shell.browser.test.tsx' },
    ],
  });
  assert.equal(verdict.code, 1);
  assert.match(verdict.reason, /не отчитались 1 из 3/);
  assert.match(verdict.reason, /Shell\.browser\.test\.tsx/);
});

test('idleVerdict: итога нет, но отчитались все файлы списка — успех', () => {
  const verdict = idleVerdict({
    output: `${CORE_FILE}\n${BROWSER_FILE}`,
    coverage: false,
    expected: [
      { file: 'D:/repo/pkg/tests/core/production-mode.test.ts' },
      { file: 'D:/repo/pkg/src/shell/ui/MergeDialog.browser.test.tsx' },
    ],
  });
  assert.equal(verdict.code, 0);
});

test('idleVerdict: итога нет, список недоступен или пуст — неуспех', () => {
  assert.equal(idleVerdict({ output: CORE_FILE, coverage: false, expected: null }).code, 1);
  assert.equal(idleVerdict({ output: CORE_FILE, coverage: false, expected: [] }).code, 1);
});

test('idleVerdict: с покрытием успех только после отчёта покрытия', () => {
  const output = `${CORE_FILE}\n${SUMMARY}`;
  assert.equal(idleVerdict({ output, coverage: true, expected: undefined }).code, 1);
  assert.equal(
    idleVerdict({
      output: `${output}\n % Coverage report from v8`,
      coverage: true,
      expected: undefined,
    }).code,
    0
  );
});

test('listArgs: покрытие и репортёры отброшены, конфиг и фильтры остаются', () => {
  assert.deepEqual(
    listArgs(['-c', 'vitest.browser.config.ts', '--coverage', '--reporter=dot', 'src/a']),
    ['-c', 'vitest.browser.config.ts', 'src/a']
  );
  // Значение через пробел не должно остаться фильтром файлов.
  assert.deepEqual(
    listArgs(['--reporter', 'dot', '--outputFile.json', 'out.json', '--coverage', 'src/a']),
    ['src/a']
  );
});
