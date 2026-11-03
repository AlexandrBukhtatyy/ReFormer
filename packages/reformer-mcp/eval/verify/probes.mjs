/**
 * Сверка живой формы с контрактом: привязка полей контракта к путям модели, структура и пробы.
 *
 * Проба описывает наблюдение над формой данными: что ввести и что должно получиться. Каждая проба
 * идёт на свежей форме: поведение реактивно, и состояние одной пробы не должно влиять на другую.
 *
 * Без браузера не проверить только то, что исполняет рендерер: видимость и доступность ввода. Такие
 * ожидания (`where: "browser"`) здесь пропускаются.
 */

import { tick } from '../lib/form-runtime.mjs';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Регулярное выражение из записи `/текст/флаги` контракта. */
export function parseRegex(text) {
  const match = /^\/(.*)\/([a-z]*)$/.exec(String(text));
  return match ? new RegExp(match[1], match[2]) : new RegExp(String(text), 'i');
}

/** Прочитать значение по пути `a.b`, `rows.0.name`. */
export function readPath(root, path) {
  return String(path)
    .split('.')
    .reduce((current, key) => (current == null ? undefined : current[key]), root);
}

function writePath(root, path, value) {
  const keys = String(path).split('.');
  const last = keys.pop();
  const parent = keys.reduce((current, key) => current?.[key], root);
  if (parent == null) throw new Error(`нет пути ${path}`);
  parent[last] = value;
}

/** Все пути значений модели: листья и массивы; поля строк — как `rows.name`. */
export function modelPaths(value, prefix = '') {
  const paths = new Map();
  for (const [key, child] of Object.entries(value ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(child)) {
      paths.set(path, { kind: 'array', sample: child });
      if (isPlainObject(child[0])) {
        for (const [inner, info] of modelPaths(child[0], path)) paths.set(inner, info);
      }
    } else if (isPlainObject(child) && !(child instanceof Date)) {
      paths.set(path, { kind: 'group', sample: child });
      for (const [inner, info] of modelPaths(child, path)) paths.set(inner, info);
    } else {
      paths.set(path, { kind: 'leaf', sample: child });
    }
  }
  return paths;
}

/**
 * Подписи полей из схемы формы: подпись → путь модели.
 *
 * В JSON-схеме путь записан строкой `$model(path)`. В схеме на TS узел держит сигнал модели, поэтому
 * путь восстанавливается сравнением сигнала с `model.$.<путь>`. Строки массивов не обходятся: их поля
 * контракт называет путём.
 */
export function schemaLabels(schema, model) {
  const labels = [];
  if (!schema) return labels;
  const paths = [...modelPaths(JSON.parse(JSON.stringify(model))).keys()];
  const signalPath = (signal) =>
    paths.find((path) => {
      try {
        return readPath(model.$, path) === signal;
      } catch {
        return false;
      }
    }) ?? null;
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isPlainObject(node)) return;
    const reference = node.model ?? node.value;
    const label = node.componentProps?.label ?? node.label;
    if (reference !== undefined && typeof label === 'string') {
      const textual = typeof reference === 'string' && /^\$model\((.+)\)$/.exec(reference);
      const path = textual ? textual[1] : signalPath(reference);
      if (path) labels.push({ label, path });
    }
    for (const key of ['root', 'children', 'steps', 'parts']) {
      if (node[key] !== undefined)
        visit(isPlainObject(node[key]) && key === 'parts' ? Object.values(node[key]) : node[key]);
    }
  };
  visit(schema);
  return labels;
}

/** Привязать поля контракта к путям: сначала по кандидатам пути, затем по подписи в схеме. */
export function bindFields(contract, paths, labels) {
  const bound = {};
  for (const field of contract.fields ?? []) {
    const candidates = [field.bind?.path, ...(field.bind?.paths ?? [])].filter(Boolean);
    let path = candidates.find((candidate) => paths.has(candidate)) ?? null;
    if (!path && field.bind?.label) {
      const pattern = parseRegex(field.bind.label);
      path = labels.find((item) => pattern.test(item.label))?.path ?? null;
    }
    bound[field.id] = path;
  }
  return bound;
}

const typeOfSample = (value) => {
  if (value instanceof Date) return 'date';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

/** Проверки структуры: поля, массивы, шаги. */
export function checkStructure(contract, paths, bound, flowSteps) {
  const checks = {};
  const missing = Object.entries(bound)
    .filter(([, path]) => !path)
    .map(([id]) => id);
  const total = Object.keys(bound).length;
  checks['runtime.structure.fields'] = missing.length
    ? ['fail', `нет ${missing.length}/${total}: ${missing.join(', ')}`.slice(0, 200)]
    : 'pass';
  const mismatched = (contract.fields ?? []).filter((field) => {
    const info = bound[field.id] ? paths.get(bound[field.id]) : null;
    if (!info || !field.type || info.sample == null) return false;
    if (info.kind !== 'leaf') return false;
    const actual = typeOfSample(info.sample);
    // Дата в модели бывает строкой: значение поля даты задаёт компонент.
    return !(field.type === 'date' && actual === 'string') && actual !== field.type;
  });
  if ((contract.fields ?? []).some((field) => field.type)) {
    checks['runtime.structure.types'] = mismatched.length
      ? [
          'fail',
          mismatched
            .map((field) => field.id)
            .join(', ')
            .slice(0, 200),
        ]
      : 'pass';
  }
  if (contract.arrays?.length) {
    const absent = contract.arrays.filter((array) => paths.get(array.path)?.kind !== 'array');
    // Поля строки видны только при непустом начальном массиве: пустой массив не считается промахом.
    const missingItems = contract.arrays.flatMap((array) =>
      paths.get(array.path)?.sample?.length
        ? (array.itemFields ?? [])
            .map((name) => `${array.path}.${name}`)
            .filter((path) => !paths.has(path))
        : []
    );
    checks['runtime.structure.arrays'] =
      absent.length || missingItems.length
        ? [
            'fail',
            `нет: ${[...absent.map((array) => array.path), ...missingItems].join(', ')}`.slice(
              0,
              200
            ),
          ]
        : 'pass';
  }
  if (contract.steps?.length) {
    const actual = flowSteps?.length ?? 0;
    checks['runtime.structure.steps'] =
      actual === contract.steps.length
        ? 'pass'
        : ['fail', `шагов ${actual}, в контракте ${contract.steps.length}`];
  }
  return checks;
}

const issuesOf = (node) => node?.issues?.value ?? null;

/** Узел формы по пути: у массива строка берётся через `at`. */
function formNode(form, path) {
  let current = form;
  for (const key of String(path).split('.')) {
    if (current == null) return undefined;
    current = /^\d+$/.test(key) ? current.at?.(Number(key)) : current[key];
  }
  return current;
}

/** Ввести значения пробы. `{ push: {...} }` добавляет строку массива, `{ removeAt: n }` удаляет. */
function applyValues(model, values, resolve) {
  for (const [key, value] of Object.entries(values ?? {})) {
    const path = resolve(key);
    if (isPlainObject(value) && 'push' in value) {
      readPath(model, path).push(value.push);
    } else if (isPlainObject(value) && value.removeAt !== undefined) {
      readPath(model, path).removeAt(value.removeAt);
    } else {
      writePath(model, path, value);
    }
  }
}

const deepEqual = (first, second) => {
  if (typeof first === 'number' && typeof second === 'number') {
    return Math.abs(first - second) < 1e-6;
  }
  return JSON.stringify(first) === JSON.stringify(second);
};

/** Несовпадения одной пробы с ожиданиями; пусто — проба прошла. */
function compareExpectations(expect, { model, form, valid }, resolve) {
  const problems = [];
  if (expect.valid !== undefined && valid !== expect.valid) {
    problems.push(`форма ${valid ? 'валидна' : 'невалидна'}, ожидалось обратное`);
  }
  for (const id of expect.invalid ?? []) {
    const node = formNode(form, resolve(id));
    // Разные поломки: узла нет вовсе (например, форма собрана без схемы) и правило не сработало.
    if (node === undefined) problems.push(`${id}: в форме нет такого узла`);
    else if (!issuesOf(node)?.length) problems.push(`${id}: ожидалось замечание`);
  }
  // Межполевое правило автор вправе повесить на любое из его полей: контракт этого не решает.
  if (expect.anyInvalid?.length) {
    const nodes = expect.anyInvalid.map((id) => formNode(form, resolve(id)));
    if (!nodes.some((node) => issuesOf(node)?.length)) {
      problems.push(`ожидалось замечание на одном из: ${expect.anyInvalid.join(', ')}`);
    }
  }
  for (const id of expect.noIssues ?? []) {
    const issues = issuesOf(formNode(form, resolve(id)));
    if (issues?.length) problems.push(`${id}: лишнее замечание ${issues[0].code}`);
  }
  for (const [id, code] of Object.entries(expect.errorCode ?? {})) {
    const issues = issuesOf(formNode(form, resolve(id))) ?? [];
    if (!issues.some((issue) => issue.code === code)) {
      problems.push(
        `${id}: нет замечания ${code}, есть ${issues.map((issue) => issue.code).join(',') || 'ничего'}`
      );
    }
  }
  for (const id of expect.disabled ?? []) {
    if (formNode(form, resolve(id))?.disabled?.value !== true)
      problems.push(`${id}: не заблокировано`);
  }
  for (const id of expect.enabled ?? []) {
    const node = formNode(form, resolve(id));
    if (!node || node.disabled?.value === true) problems.push(`${id}: не доступно`);
  }
  for (const [id, value] of Object.entries(expect.values ?? {})) {
    const actual = readPath(model, resolve(id));
    if (!deepEqual(actual, value)) {
      problems.push(`${id}: ${JSON.stringify(actual)}, ожидалось ${JSON.stringify(value)}`);
    }
  }
  for (const id of expect.positive ?? []) {
    const actual = readPath(model, resolve(id));
    if (!(typeof actual === 'number' && actual > 0)) {
      problems.push(`${id}: ${JSON.stringify(actual)}, ожидалось положительное число`);
    }
  }
  // Значение, которое следует из других полей формы: выражение из контракта, данные стенда.
  for (const { id, expression, tolerance = 1e-6 } of expect.expressions ?? []) {
    const actual = readPath(model, resolve(id));
    const expected = new Function('model', `return (${expression});`)(model);
    if (typeof actual !== 'number' || !(Math.abs(actual - expected) <= tolerance)) {
      problems.push(`${id}: ${JSON.stringify(actual)}, по формуле ${expected}`);
    }
  }
  for (const [id, length] of Object.entries(expect.arrayLength ?? {})) {
    const actual = readPath(model, resolve(id))?.length;
    if (actual !== length) problems.push(`${id}: длина ${actual}, ожидалась ${length}`);
  }
  return problems;
}

/**
 * Пройти пробы контракта.
 *
 * @param {object} options
 * @param {object} options.contract
 * @param {Record<string, string|null>} options.bound
 * @param {() => Promise<{ model: any, form: any, validate: () => Promise<boolean>, dispose?: () => void }>} options.createInstance
 * @returns {Promise<Record<string, unknown>>} проверки `runtime.probe.<id>`
 */
export async function runProbes({ contract, bound, createInstance }) {
  const checks = {};
  const resolve = (key) => {
    const [head, ...rest] = String(key).split('.');
    const base = bound[head];
    if (base) return [base, ...rest].join('.');
    return String(key);
  };
  for (const probe of contract.probes ?? []) {
    const id = `runtime.probe.${probe.id}`;
    if (probe.where === 'browser') continue;
    let instance;
    try {
      instance = await createInstance();
      await tick();
      if (probe.sample !== false) applyValues(instance.model, contract.sample, resolve);
      applyValues(instance.model, probe.set, resolve);
      await tick();
      await tick();
      const needsValidation = ['valid', 'invalid', 'anyInvalid', 'errorCode', 'noIssues'].some(
        (key) => probe.expect?.[key] !== undefined
      );
      const valid = needsValidation ? await instance.validate() : null;
      await tick();
      const problems = compareExpectations(
        probe.expect ?? {},
        { model: instance.model, form: instance.form, valid },
        resolve
      );
      checks[id] = problems.length ? ['fail', problems.join('; ').slice(0, 200)] : 'pass';
    } catch (error) {
      checks[id] = ['fail', `исключение: ${error?.message ?? error}`.slice(0, 200)];
    } finally {
      try {
        instance?.dispose?.();
      } catch {
        // Снятие формы на вердикт не влияет.
      }
    }
  }
  return checks;
}
