/**
 * Проверка: ajv достижим ТОЛЬКО из той точки входа, которая для него заведена.
 *
 * ajv тяжелее, чем всё ядро реестра форм вместе взятое. Инвариант «ajv только в subpath» держался
 * до сих пор одним комментарием в исходнике — то есть не держался ничем: достаточно одного импорта
 * из основного модуля, чтобы он поехал в каждое приложение, и заметить это можно было бы только
 * по размеру бандла.
 *
 * ## Почему ищем НОСИТЕЛЯ, а не спецификатор
 *
 * Первая версия этой проверки искала внешний импорт `'ajv'` в графе dist — и была вакуумной:
 * ajv намеренно НЕ внешний, он инлайнится в свою точку входа (см. renderer-json/vite.config.ts).
 * Спецификатора `'ajv'` в собранных файлах не существует в принципе, поэтому проверка оставалась
 * зелёной при любом состоянии кода. Негативный тест её не разоблачил: он проверял искусственно
 * вставленный `import 'ajv'` — условие, которое в реальной сборке не возникает.
 *
 * Поэтому ajv опознаётся по СОДЕРЖИМОМУ файла (строковые маркеры его рантайма — переживают
 * минификацию), а нарушением считается достижимость такого файла по графу импортов из точки
 * входа, которой ajv не положен.
 *
 * @module scripts/check-ajv-isolation
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { init, parse } from 'es-module-lexer';

await init;

const RULES = [
  {
    name: '@reformer/renderer-json',
    dir: 'packages/reformer-renderer-json/dist',
    entries: ['index.js'],
    allowed: ['validate.js'],
  },
  {
    name: '@reformer/form-registry',
    dir: 'packages/reformer-form-registry/dist',
    entries: ['index.js', 'react.js', 'storage.js', 'guard.js'],
    allowed: ['manifest.js'],
  },
];

/**
 * Опознание ajv по содержимому: строковые литералы его рантайма переживают минификацию.
 * Требуется ДВА совпадения — одиночное могло бы встретиться в чужом коде случайно.
 */
const AJV_MARKERS = [
  'must have required property',
  'must NOT have additional properties',
  'must match "then" schema',
  'strictTypes',
  'ajv',
];

const carriesAjv = (code) => AJV_MARKERS.filter((m) => code.includes(m)).length >= 2;

/** Внешние спецификаторы, по которым ajv приезжает из соседнего пакета. */
const AJV_EXTERNAL = /^@reformer\/renderer-json\/validate$|^ajv($|\/)|ajv-formats/;

let failed = false;
let checkedEntries = 0;

for (const { name, dir, entries, allowed } of RULES) {
  if (!existsSync(dir)) {
    // Пропуск здесь означал бы зелёную проверку на несобранном пакете.
    console.error(`✗ ${name}: нет ${dir} — соберите пакет перед проверкой`);
    failed = true;
    continue;
  }

  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const local = new Map();
  const external = new Map();
  const carrier = new Set();

  for (const f of files) {
    const code = readFileSync(join(dir, f), 'utf8');
    const [imports] = parse(code);
    // Учитываем ТОЛЬКО статические импорты (`i.d === -1`). Динамический `import('./validate')` —
    // это и есть механизм изоляции: сборщик выносит его в отдельный чанк, и ajv не попадает
    // в основной бандл, пока потребитель не включит валидацию. Считать его нарушением значило бы
    // требовать убрать ровно то, чем изоляция и достигается.
    const specs = imports.filter((i) => i.d === -1 && i.n).map((i) => i.n);
    local.set(
      f,
      specs.filter((s) => s.startsWith('.')).map((s) => s.replace(/^\.\//, ''))
    );
    external.set(
      f,
      specs.filter((s) => !s.startsWith('.'))
    );
    if (carriesAjv(code)) carrier.add(f);
  }

  const hasExternalAjv = [...external.values()].some((s) => s.some((x) => AJV_EXTERNAL.test(x)));

  // Носитель обязан обнаружиться: если ajv не найден нигде, проверка ничего не доказывает.
  // Молчаливо зелёный результат здесь опаснее ложной тревоги.
  if (!carrier.size && !hasExternalAjv) {
    console.error(
      `✗ ${name}: ajv не найден нигде в dist/ — маркеры не сработали, изоляция НЕ доказана`
    );
    failed = true;
    continue;
  }

  const misplaced = [...carrier].filter(
    (f) => !allowed.includes(f) && !/-[A-Za-z0-9_-]{8}\.js$/.test(f)
  );
  if (misplaced.length) {
    console.error(
      `✗ ${name}: ajv лежит в ${misplaced.join(', ')}, а ожидался в ${allowed.join(', ')}`
    );
    failed = true;
    continue;
  }

  // Достижимость: из каждой точки входа обходим граф и смотрим, не дотягивается ли он
  // до носителя ajv — своего файла, разрешённой точки входа или внешнего subpath.
  const reaches = (file, seen = new Set()) => {
    if (seen.has(file)) return false;
    seen.add(file);
    if (carrier.has(file)) return `чанк ${file} содержит ajv`;
    if ((external.get(file) ?? []).some((s) => AJV_EXTERNAL.test(s))) {
      return `${file} импортирует ajv извне`;
    }
    for (const dep of local.get(file) ?? []) {
      if (allowed.includes(dep)) return `${file} → ${dep}`;
      const via = reaches(dep, seen);
      if (via) return via;
    }
    return false;
  };

  const offenders = [];
  for (const entry of entries) {
    if (!files.includes(entry)) continue;
    checkedEntries++;
    const via = reaches(entry);
    if (via) offenders.push(`${entry}: ${via}`);
  }

  if (offenders.length) {
    failed = true;
    console.error(`✗ ${name}: ajv достижим из точки входа, которой он не положен:`);
    offenders.forEach((o) => console.error(`    ${o}`));
  } else {
    const n = entries.filter((e) => files.includes(e)).length;
    console.log(`✓ ${name}: ajv изолирован в ${allowed.join(', ')} (точек входа проверено: ${n})`);
  }
}

if (!checkedEntries) {
  console.error('✗ не проверено ни одной точки входа — проверка бессмысленна');
  failed = true;
}

process.exit(failed ? 1 : 0);
