/**
 * Решение обёртки `run-vitest.mjs`, когда vitest замолчал и не завершился сам.
 *
 * Чистые функции над текстом вывода — чтобы правило выхода проверялось тестами, а не прогоном,
 * который зависает раз в месяц. Сама обёртка только собирает вывод и вызывает `idleVerdict`.
 */

// eslint-disable-next-line no-control-regex -- вырезаем именно цветовые escape-последовательности
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Строка файла в отчёте default-репортёра: ` ✓ path (N tests) 12ms` или с меткой проекта. */
const FILE_LINE = /^ [✓❯×↓] +(?:(.+?) {2})?(\S+\.[cm]?[jt]sx?)(?= |$)/;

/** Итог прогона: `Test Files  176 passed (176)` — печатается, только когда отчитались все файлы. */
const SUMMARY = /^ *Test Files {2}.*\(\d+\)/m;

/** Аргументы, которые `vitest list` не нужны или мешают: покрытие и репортёры. */
const LIST_IRRELEVANT = /^--(?:coverage|reporter|outputFile)\b/;

export function stripAnsi(text) {
  return text.replace(ANSI, '');
}

/** Отчитавшиеся файлы: `{ project, path }` по строкам файлов, без повторов. */
export function reportedFiles(output) {
  const seen = new Map();
  for (const line of stripAnsi(output).split(/\r?\n/)) {
    const match = FILE_LINE.exec(line);
    if (!match) continue;
    const [, project = '', path] = match;
    seen.set(`${project}|${path}`, { project, path });
  }
  return [...seen.values()];
}

/** Пометки о падениях — те же, по которым обёртка решала и раньше. */
export function hasFailures(output) {
  const text = stripAnsi(output);
  return (
    /\bTest Files[^\n]*\bfailed\b/.test(text) ||
    /\bTests\s+\d+\s+failed\b/.test(text) ||
    / FAIL\b/.test(text) ||
    /\bUnhandled\b/.test(text) ||
    // Порог покрытия не выполнен: vitest печатает это и выставил бы exit 1, но мог зависнуть.
    /^ERROR: (Coverage for|Uncovered) /m.test(text)
  );
}

export function hasSummary(output) {
  return SUMMARY.test(stripAnsi(output));
}

/** Флаги со значением через пробел: `--reporter dot`, `--outputFile out.json`. */
const TAKES_VALUE = /^--(?:reporter|outputFile)(?:\.[\w.]+)?$/;

/** Аргументы для `vitest list --filesOnly --json` из аргументов прогона. */
export function listArgs(runArgs) {
  const result = [];
  for (let i = 0; i < runArgs.length; i++) {
    const arg = runArgs[i];
    if (!LIST_IRRELEVANT.test(arg)) result.push(arg);
    else if (TAKES_VALUE.test(arg)) i++; // значение флага — следующим аргументом
  }
  return result;
}

/**
 * Ожидаемые файлы, которых нет в отчёте. `expected` — разобранный `vitest list --filesOnly --json`:
 * `[{ file: абсолютный путь, projectName? }]`. В отчёте путь относительный, поэтому сверка — по
 * окончанию пути; метка проекта сверяется, когда она есть с обеих сторон.
 */
export function missingFiles(expected, reported) {
  const normalize = (p) => p.replace(/\\/g, '/');
  return expected.filter(({ file, projectName }) => {
    const full = normalize(file);
    return !reported.some(
      ({ project, path }) =>
        (full === normalize(path) || full.endsWith(`/${normalize(path)}`)) &&
        (!projectName || !project || projectName === project)
    );
  });
}

/**
 * Код выхода при простое. Итоговая строка vitest — единственное свидетельство, что отчитались все
 * файлы. Без неё успех засчитывается, только если сверка со списком файлов показала, что пропавших
 * нет; список недоступен (`expected === null`) — неуспех: зелёный итог не должен скрывать файлы,
 * которые не отчитались.
 *
 * @returns {{ code: 0 | 1, reason: string }}
 */
export function idleVerdict({ output, coverage, expected }) {
  if (hasFailures(output)) return { code: 1, reason: 'в выводе есть падения' };
  const coverageDone = !coverage || /Coverage report from v8/.test(stripAnsi(output));
  if (!coverageDone) return { code: 1, reason: 'отчёт покрытия не напечатан' };
  if (hasSummary(output)) return { code: 0, reason: 'итог прогона напечатан, падений нет' };

  if (expected === null) {
    return { code: 1, reason: 'итога прогона нет, а список файлов получить не удалось' };
  }
  if (expected.length === 0) {
    return { code: 1, reason: 'итога прогона нет, а список файлов пуст — сверять не с чем' };
  }
  const missing = missingFiles(expected, reportedFiles(output));
  if (missing.length === 0) {
    return {
      code: 0,
      reason: `итога нет, но отчитались все ${expected.length} файлов из списка`,
    };
  }
  const names = missing
    .slice(0, 10)
    .map(({ file }) => `  - ${file}`)
    .join('\n');
  const more = missing.length > 10 ? `\n  … и ещё ${missing.length - 10}` : '';
  return {
    code: 1,
    reason: `не отчитались ${missing.length} из ${expected.length} файлов:\n${names}${more}`,
  };
}
