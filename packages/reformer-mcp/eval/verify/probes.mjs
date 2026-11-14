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
  return schemaFields(schema, model).filter((item) => typeof item.label === 'string');
}

/** Поля узла схемы и его потомков: путь модели и подпись (у поля без подписи — `null`). */
function schemaFields(schema, model) {
  const fields = [];
  if (!schema) return fields;
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
    if (reference !== undefined) {
      const textual = typeof reference === 'string' && /^\$model\((.+)\)$/.exec(reference);
      const path = textual ? textual[1] : signalPath(reference);
      if (path) fields.push({ label: typeof label === 'string' ? label : null, path });
    }
    for (const key of ['root', 'children', 'steps', 'parts']) {
      if (node[key] !== undefined)
        visit(isPlainObject(node[key]) && key === 'parts' ? Object.values(node[key]) : node[key]);
    }
  };
  visit(schema);
  return fields;
}

/** Узел схемы по `selector`: поиск в глубину по тем же ключам, что обходит `schemaFields`. */
function findSchemaNode(node, selector) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findSchemaNode(child, selector);
      if (found) return found;
    }
    return null;
  }
  if (!isPlainObject(node)) return null;
  if (node.selector === selector) return node;
  for (const key of ['root', 'children', 'steps', 'parts']) {
    if (node[key] === undefined) continue;
    const found = findSchemaNode(
      isPlainObject(node[key]) && key === 'parts' ? Object.values(node[key]) : node[key],
      selector
    );
    if (found) return found;
  }
  return null;
}

/**
 * Шаги мастера, как их видит пользователь: заголовок и поля шага. Шаг потока (`formFlow.steps`)
 * назван `selector` своего узла в схеме, а заголовок и поля живут в этом узле.
 *
 * @returns {Array<{ id: string, title: string|null, paths: string[] }>}
 */
export function schemaSteps(schema, model, flowSteps) {
  return (flowSteps ?? []).map((step) => {
    const node = schema ? findSchemaNode(schema, step.id) : null;
    const title = node?.componentProps?.title ?? node?.title ?? null;
    return {
      id: step.id,
      title: typeof title === 'string' ? title : null,
      paths: node ? schemaFields(node, model).map((item) => item.path) : [],
    };
  });
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

/**
 * Проверки структуры: поля, массивы, шаги, поля, которых быть не должно.
 *
 * @param {object} [details]
 * @param {Array<{ label: string, path: string }>} [details.labels] - подписи полей схемы (для `absent`)
 * @param {ReturnType<typeof schemaSteps>} [details.steps] - шаги со схемы (для заголовков и полей)
 */
export function checkStructure(contract, paths, bound, flowSteps, { labels = [], steps } = {}) {
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
    checks['runtime.structure.steps'] = stepsCheck(contract, bound, flowSteps, steps);
  }
  if (contract.absent?.length) {
    // Удалённое поле не должно найтись ни по одному кандидату пути, ни по подписи.
    const present = contract.absent.flatMap((field) => {
      const candidates = [field.bind?.path, ...(field.bind?.paths ?? [])].filter(Boolean);
      const byPath = candidates.find((candidate) => paths.has(candidate));
      if (byPath) return [`${field.id} (путь ${byPath})`];
      const pattern = field.bind?.label ? parseRegex(field.bind.label) : null;
      const byLabel = pattern && labels.find((item) => pattern.test(item.label));
      return byLabel ? [`${field.id} (подпись «${byLabel.label}»)`] : [];
    });
    checks['runtime.structure.absent'] = present.length
      ? ['fail', `осталось: ${present.join(', ')}`.slice(0, 200)]
      : 'pass';
  }
  return checks;
}

/**
 * Шаги: число, затем заголовок и поля каждого. Поле контракта на шаге — его путь среди путей узла
 * шага или под ним (поле группы, строка массива). В `fields` шага — id полей контракта или пути
 * массивов.
 */
function stepsCheck(contract, bound, flowSteps, steps) {
  const actual = flowSteps?.length ?? 0;
  if (actual !== contract.steps.length) {
    return ['fail', `шагов ${actual}, в контракте ${contract.steps.length}`];
  }
  const problems = [];
  contract.steps.forEach((expected, index) => {
    const step = steps?.[index];
    const number = index + 1;
    if (expected.title && !(step?.title && parseRegex(expected.title).test(step.title))) {
      problems.push(`шаг ${number}: заголовок «${step?.title ?? '—'}», ожидался ${expected.title}`);
    }
    const misplaced = (expected.fields ?? []).filter((id) => {
      // Поле контракта — по привязке; массив (его нет среди полей) — по своему пути.
      const path = id in bound ? bound[id] : id;
      if (!path) return false; // ненайденное поле уже назвала проверка полей
      return !(step?.paths ?? []).some(
        (stepPath) => stepPath === path || path.startsWith(`${stepPath}.`)
      );
    });
    if (misplaced.length) problems.push(`шаг ${number}: нет ${misplaced.join(', ')}`);
  });
  return problems.length ? ['fail', problems.join('; ').slice(0, 200)] : 'pass';
}

const issuesOf = (node) => node?.issues?.value ?? null;
/** Замечания, которые делают поле невалидным: предупреждение (`severity: 'warning'`) — не из них. */
const errorsOf = (node) => (issuesOf(node) ?? []).filter((issue) => issue.severity !== 'warning');

/** Узел формы по пути: у массива строка берётся через `at`. */
function formNode(form, path) {
  let current = form;
  for (const key of String(path).split('.')) {
    if (current == null) return undefined;
    current = /^\d+$/.test(key) ? current.at?.(Number(key)) : current[key];
  }
  return current;
}

/**
 * Дата из записи контракта: ISO-дата (`2024-05-01`) или сдвиг от сегодняшнего дня (`+3d`, `-18y`,
 * `+2m`). Сдвиг нужен правилам вроде `futureDate` и `minAge`: фиксированная дата со временем
 * перестала бы быть «будущей».
 */
export function contractDate(text) {
  const shift = /^([+-]\d+)([dmy])$/.exec(String(text));
  if (!shift) return new Date(String(text));
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const amount = Number(shift[1]);
  if (shift[2] === 'd') date.setDate(date.getDate() + amount);
  if (shift[2] === 'm') date.setMonth(date.getMonth() + amount);
  if (shift[2] === 'y') date.setFullYear(date.getFullYear() + amount);
  return date;
}

const isoDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Значение из контракта для модели: `{ $date }` — объект `Date`, `{ $dateString }` — `YYYY-MM-DD`. */
export function contractValue(value) {
  if (isPlainObject(value) && '$date' in value) return contractDate(value.$date);
  if (isPlainObject(value) && '$dateString' in value) {
    return isoDay(contractDate(value.$dateString));
  }
  if (Array.isArray(value)) return value.map(contractValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, contractValue(item)])
    );
  }
  return value;
}

/** Ввести значения пробы. `{ push: {...} }` добавляет строку массива, `{ removeAt: n }` удаляет. */
function applyValues(model, values, resolve) {
  for (const [key, value] of Object.entries(values ?? {})) {
    const path = resolve(key);
    if (isPlainObject(value) && 'push' in value) {
      readPath(model, path).push(contractValue(value.push));
    } else if (isPlainObject(value) && value.removeAt !== undefined) {
      readPath(model, path).removeAt(value.removeAt);
    } else {
      writePath(model, path, contractValue(value));
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
    else if (!errorsOf(node).length) problems.push(`${id}: ожидалось замечание`);
  }
  // Межполевое правило автор вправе повесить на любое из его полей: контракт этого не решает.
  if (expect.anyInvalid?.length) {
    const nodes = expect.anyInvalid.map((id) => formNode(form, resolve(id)));
    if (!nodes.some((node) => errorsOf(node).length)) {
      problems.push(`ожидалось замечание на одном из: ${expect.anyInvalid.join(', ')}`);
    }
  }
  for (const id of expect.noIssues ?? []) {
    const issues = issuesOf(formNode(form, resolve(id)));
    if (issues?.length) problems.push(`${id}: лишнее замечание ${issues[0].code}`);
  }
  // Предупреждение (`severity: 'warning'`): замечание есть, но форму оно не блокирует.
  for (const id of expect.warnings ?? []) {
    const issues = issuesOf(formNode(form, resolve(id))) ?? [];
    if (!issues.some((issue) => issue.severity === 'warning')) {
      problems.push(
        `${id}: нет предупреждения, есть ${issues.map((issue) => `${issue.code}/${issue.severity ?? 'error'}`).join(',') || 'ничего'}`
      );
    }
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
 * @param {() => Promise<{ model: any, form: any, validate: () => Promise<boolean>, validateStep?: (step: number) => Promise<boolean>, dispose?: () => void }>} options.createInstance
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
  // Поле образца, которого в форме нет, пропускается: его отсутствие уже назвала проверка полей, а
  // запись в несуществующий путь уронила бы исключением и пробы, которым это поле не нужно.
  const boundSample = Object.fromEntries(
    Object.entries(contract.sample ?? {}).filter(
      ([key]) => bound[String(key).split('.')[0]] !== null
    )
  );
  for (const probe of contract.probes ?? []) {
    const id = `runtime.probe.${probe.id}`;
    if (probe.where === 'browser') continue;
    let instance;
    try {
      instance = await createInstance();
      await tick();
      if (probe.sample !== false) applyValues(instance.model, boundSample, resolve);
      // `set` списком — шаги по порядку: между ними отрабатывает поведение (сброс, копирование), как
      // между действиями пользователя.
      for (const values of Array.isArray(probe.set) ? probe.set : [probe.set]) {
        applyValues(instance.model, values, resolve);
        await tick();
        await tick();
      }
      const needsValidation = [
        'valid',
        'invalid',
        'anyInvalid',
        'errorCode',
        'noIssues',
        'warnings',
      ].some((key) => probe.expect?.[key] !== undefined);
      // `step: N` (с 1) — только правила шага N, как их проверяет переход «Далее» (`flow.next()`).
      const valid = !needsValidation
        ? null
        : probe.step !== undefined
          ? await instance.validateStep(probe.step)
          : await instance.validate();
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
