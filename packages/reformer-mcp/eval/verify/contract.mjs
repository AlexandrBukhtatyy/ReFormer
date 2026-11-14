/**
 * Чтение контракта сценария с наследованием.
 *
 * Контракт правки — это контракт формы, с которой правка началась, плюс дельта: так «остальное не
 * сломано» проверяется пробами базы, а не их копией, которая со временем разойдётся с оригиналом.
 *
 * - `extends` — путь к базовому контракту относительно файла (база сама может наследовать);
 * - `drop: { fields, probes, arrays }` — что из базы снять: поле уходит вместе со своим значением
 *   в `sample`; проба базы, которая упоминает снятое поле, обязана быть снята явно, иначе ошибка;
 * - `fields` — поле с тем же `id` заменяет базовое на его месте, новое встаёт после `after` (id
 *   поля) или в конец: порядок полей — ожидаемый порядок в снимке доступности;
 * - `probes` и `arrays` — замена по `id` (`path`), новые — в конец;
 * - `sample` — поверх базового, поле за полем;
 * - `absent` — дописывается к базовому; `steps` и прочие ключи — заменяют.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Ключи ожиданий пробы, перечисляющие id полей списком. */
const LIST_EXPECTATIONS = [
  'invalid',
  'anyInvalid',
  'noIssues',
  'disabled',
  'enabled',
  'positive',
  'hidden',
  'visible',
  'readonly',
  'warnings',
];
/** Ключи ожиданий пробы — объекты с id поля в ключе. */
const MAP_EXPECTATIONS = ['errorCode', 'values', 'arrayLength'];

/** Id полей, которые упоминает проба: в `set` и в ожиданиях (первый сегмент пути `rows.0.name`). */
export function probeFieldIds(probe) {
  const steps = Array.isArray(probe.set) ? probe.set : [probe.set ?? {}];
  const keys = [
    ...steps.flatMap((values) => Object.keys(values ?? {})),
    ...LIST_EXPECTATIONS.flatMap((key) => probe.expect?.[key] ?? []),
    ...MAP_EXPECTATIONS.flatMap((key) => Object.keys(probe.expect?.[key] ?? {})),
    ...(probe.expect?.expressions ?? []).map((item) => item.id),
  ];
  return [...new Set(keys.map((key) => String(key).split('.')[0]))];
}

/** Поля базы с заменами и вставками контракта-наследника. */
function mergeFields(baseFields, childFields, dropped) {
  const fields = baseFields.filter((field) => !dropped.has(field.id));
  for (const field of childFields) {
    const { after, ...rest } = field;
    const at = fields.findIndex((item) => item.id === field.id);
    if (at >= 0) {
      fields[at] = rest;
      continue;
    }
    if (after === undefined) {
      fields.push(rest);
      continue;
    }
    const anchor = fields.findIndex((item) => item.id === after);
    if (anchor < 0) throw new Error(`поле ${field.id}: after «${after}» нет среди полей`);
    fields.splice(anchor + 1, 0, rest);
  }
  return fields;
}

/** Слить по ключу: элемент наследника заменяет базовый с тем же ключом, новые — в конец. */
function mergeByKey(base, child, key, dropped) {
  const merged = base.filter((item) => !dropped.has(item[key]));
  for (const item of child) {
    const at = merged.findIndex((existing) => existing[key] === item[key]);
    if (at >= 0) merged[at] = item;
    else merged.push(item);
  }
  return merged;
}

/**
 * Контракт-наследник поверх базового.
 *
 * @param {object} base - базовый контракт, уже без `extends`
 * @param {object} child - контракт с `extends`
 * @param {string} [name] - имя для сообщений об ошибке
 */
export function mergeContract(base, child, name = child.case ?? 'контракт') {
  const drop = child.drop ?? {};
  const droppedFields = new Set(drop.fields ?? []);
  const droppedProbes = new Set(drop.probes ?? []);
  for (const id of droppedFields) {
    if (!(base.fields ?? []).some((field) => field.id === id)) {
      throw new Error(`${name}: drop.fields — в базе нет поля ${id}`);
    }
  }
  for (const id of droppedProbes) {
    if (!(base.probes ?? []).some((probe) => probe.id === id)) {
      throw new Error(`${name}: drop.probes — в базе нет пробы ${id}`);
    }
  }
  const keptBaseProbes = (base.probes ?? []).filter((probe) => !droppedProbes.has(probe.id));
  for (const probe of keptBaseProbes) {
    if ((child.probes ?? []).some((item) => item.id === probe.id)) continue;
    const stale = probeFieldIds(probe).filter((id) => droppedFields.has(id));
    if (stale.length) {
      throw new Error(
        `${name}: проба базы ${probe.id} упоминает снятое поле ${stale.join(', ')} — сними её в drop.probes или замени`
      );
    }
  }

  const sample = { ...(base.sample ?? {}) };
  for (const id of droppedFields) delete sample[id];
  Object.assign(sample, child.sample ?? {});

  const { extends: _extends, drop: _drop, ...rest } = child;
  return {
    ...base,
    ...rest,
    fields: mergeFields(base.fields ?? [], child.fields ?? [], droppedFields),
    probes: mergeByKey(base.probes ?? [], child.probes ?? [], 'id', droppedProbes),
    arrays: mergeByKey(base.arrays ?? [], child.arrays ?? [], 'path', new Set(drop.arrays ?? [])),
    absent: [...(base.absent ?? []), ...(child.absent ?? [])],
    sample,
  };
}

/**
 * Прочитать контракт сценария, раскрыв цепочку `extends`.
 *
 * @param {string} file
 * @returns {object} контракт без `extends` и `drop`
 */
export function readContract(file, chain = []) {
  const resolved = path.resolve(file);
  if (chain.includes(resolved)) {
    throw new Error(`цикл extends: ${[...chain, resolved].join(' → ')}`);
  }
  const contract = JSON.parse(readFileSync(resolved, 'utf8'));
  if (!contract.extends) return contract;
  const base = readContract(path.resolve(path.dirname(resolved), contract.extends), [
    ...chain,
    resolved,
  ]);
  const merged = mergeContract(base, contract, path.relative(process.cwd(), resolved));
  // Пустые списки, которых не было ни в базе, ни в наследнике, контракт не загромождают.
  for (const key of ['arrays', 'absent']) {
    if (merged[key].length === 0 && base[key] === undefined && contract[key] === undefined) {
      delete merged[key];
    }
  }
  return merged;
}

/**
 * Текст контракта для отпечатка. У наследника — раскрытый: правка базы меняет и его отпечаток. У
 * контракта без `extends` — текст файла, как раньше: отпечатки в истории остаются сравнимыми.
 */
export function contractText(file) {
  const raw = readFileSync(file, 'utf8');
  return JSON.parse(raw).extends ? JSON.stringify(readContract(file)) : raw;
}
