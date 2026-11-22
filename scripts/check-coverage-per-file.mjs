#!/usr/bin/env node
// Гейт покрытия на файл: минимум строк и ветвей для КАЖДОГО модуля пакета.
//
// Агрегатные пороги vitest (`coverage.thresholds` в vitest.config.ts) ловят общий регресс, но
// не видят новый модуль без тестов: двести непокрытых строк на фоне двух тысяч покрытых сдвигают
// агрегат меньше чем на процент. Скрипт читает отчёт `json-summary` прогона с покрытием и
// требует минимум по каждому файлу.
//
// Исключение из минимума — только с причиной (`reason`) и задачей beads (`issue`), по которой
// файл догоняют. Ненужное исключение — тоже ошибка: файл и так проходит минимум, его нет в
// отчёте или в нём нет исполняемых строк. Иначе список исключений копит мусор и перестаёт
// что-либо значить.
//
// Файлы без исполняемых строк (модули из одних типов после стирания) не оцениваются; метрика с
// нулём элементов (файл без ветвлений) считается выполненной.
//
// Запуск из каталога пакета после прогона с покрытием:
//   node ../../scripts/check-coverage-per-file.mjs [--config <файл>] [--summary <файл>]
// По умолчанию конфиг — coverage.per-file.json, отчёт — coverage/coverage-summary.json.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const METRICS = {
  lines: 'строки',
  statements: 'инструкции',
  branches: 'ветви',
  functions: 'функции',
};
const ISSUE_ID = /^ReFormer-[a-z0-9]+(\.\d+)*$/;

const pluralRules = new Intl.PluralRules('ru');
/** Число со словом в нужной форме: `count(94, ['файл', 'файла', 'файлов'])` → «94 файла». */
const count = (value, [one, few, many]) =>
  `${value} ${{ one, few, many }[pluralRules.select(value)] ?? many}`;

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const packageDir = process.cwd();
const configPath = path.resolve(packageDir, option('--config', 'coverage.per-file.json'));
const summaryPath = path.resolve(packageDir, option('--summary', 'coverage/coverage-summary.json'));

const stop = (message) => {
  console.error(`check-coverage-per-file: ${message}`);
  process.exit(1);
};

if (!existsSync(configPath)) stop(`нет конфига минимума покрытия ${configPath}`);
if (!existsSync(summaryPath)) {
  stop(`нет отчёта ${summaryPath} — сначала прогон с покрытием (reporter json-summary)`);
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));

/** Путь относительно пакета, через `/`: ключи отчёта абсолютные, в конфиге — относительные. */
const normalize = (file) =>
  path.relative(packageDir, path.resolve(packageDir, file)).split(path.sep).join('/');

/** Пороги из объекта: только известные метрики, только числа 0…100. */
const thresholdsOf = (source, where) => {
  const thresholds = {};
  for (const [key, value] of Object.entries(source)) {
    if (!(key in METRICS)) continue;
    if (typeof value !== 'number' || value < 0 || value > 100) {
      stop(`${where}: порог «${key}» должен быть числом от 0 до 100`);
    }
    thresholds[key] = value;
  }
  return thresholds;
};

const minimum = thresholdsOf(config.min ?? {}, 'min');
if (Object.keys(minimum).length === 0) {
  stop(`в min нет ни одного порога (${Object.keys(METRICS).join(', ')})`);
}

const problems = [];
const exceptions = new Map();
for (const [index, exception] of (config.exceptions ?? []).entries()) {
  const where = `exceptions[${index}]`;
  if (typeof exception.file !== 'string' || exception.file === '') stop(`${where}: нет file`);
  const file = normalize(exception.file);
  if (typeof exception.reason !== 'string' || exception.reason.trim() === '') {
    problems.push(`исключение ${file}: нет reason — почему файл ниже минимума`);
  }
  if (typeof exception.issue !== 'string' || !ISSUE_ID.test(exception.issue)) {
    problems.push(`исключение ${file}: issue должен быть id задачи beads (ReFormer-xxxx)`);
  }
  const thresholds = thresholdsOf(exception, where);
  if (Object.keys(thresholds).length === 0) {
    problems.push(`исключение ${file}: не задан ни один сниженный порог`);
  }
  if (exceptions.has(file)) problems.push(`исключение ${file} объявлено дважды`);
  exceptions.set(file, { ...exception, thresholds });
}

const files = new Map(
  Object.entries(summary)
    .filter(([key]) => key !== 'total')
    .map(([key, entry]) => [normalize(key), entry])
);

for (const file of exceptions.keys()) {
  if (!files.has(file)) problems.push(`исключение ${file} не нужно: файла нет в отчёте покрытия`);
}

/** Метрика выполнена: в ней нет элементов или процент не ниже порога. */
const meets = (entry, metric, threshold) =>
  entry[metric].total === 0 || entry[metric].pct >= threshold;

let checked = 0;
let skipped = 0;
for (const [file, entry] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
  const exception = exceptions.get(file);
  if (entry.lines.total === 0) {
    skipped++;
    if (exception) problems.push(`исключение ${file} не нужно: в файле нет исполняемых строк`);
    continue;
  }
  checked++;
  const floor = { ...minimum, ...exception?.thresholds };
  for (const [metric, threshold] of Object.entries(floor)) {
    if (meets(entry, metric, threshold)) continue;
    const suffix = exception ? ` (исключение, ${exception.issue})` : '';
    problems.push(`${file}: ${METRICS[metric]} ${entry[metric].pct} % < ${threshold} %${suffix}`);
  }
  if (
    exception &&
    Object.entries(minimum).every(([metric, value]) => meets(entry, metric, value))
  ) {
    problems.push(`исключение ${file} не нужно: файл проходит общий минимум`);
  }
}

const floorText = Object.entries(minimum)
  .map(([metric, value]) => `${METRICS[metric]} ≥ ${value} %`)
  .join(', ');

if (problems.length > 0) {
  const violations = count(problems.length, ['нарушение', 'нарушения', 'нарушений']);
  console.error(`Покрытие по файлам (минимум: ${floorText}) — ${violations}:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `Покрытие по файлам: ${count(checked, ['файл', 'файла', 'файлов'])} не ниже минимума ` +
    `(${floorText}); без исполняемых строк — ${skipped}; исключений — ${exceptions.size}.`
);
