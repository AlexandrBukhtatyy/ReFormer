/**
 * Сборка файлов бандла из `FormIntent`. Каждый билдер — чистая `(intent) => string`, без IO:
 * так их можно проверять юнит-тестом, а не прогоном сервера.
 *
 * Все шесть держатся в одном модуле сознательно: это однотипные шаблонные функции над одним
 * контрактом, и разнесение по шести файлам добавило бы навигации, но не разделения зон
 * ответственности — читать их всё равно приходится вместе.
 *
 * Эталон структуры — `projects/reformer-builder/src/app/form-templates.ts`; оттуда взята
 * раскладка файлов и стиль, но не код: у билдера свой контекст (он генерирует под редактор),
 * импортировать его сюда было бы связыванием двух несвязанных проектов.
 */

import type {
  ArrayIntent,
  BehaviorIntent,
  FieldIntent,
  FieldType,
  FormIntent,
  LayoutNode,
  ReformerTargetStack,
  ValidationRuleIntent,
} from './form-intent.js';
import { UI_KIT_CONTAINER_EXPORTS, UI_KIT_FIELD_EXPORTS } from './ui-kit-components.js';
import {
  buildFormSchemaJson,
  buildFormSchemaJsonTs,
  buildFormSchemaTs,
  buildSchemaLayout,
  collectSteps,
  stepKeyOf,
} from './schema-emit.js';

/** Один файл бандла. */
export interface BundleFile {
  path: string;
  content: string;
}

const TS_TYPE: Record<string, string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  date: 'Date | null',
  array: 'unknown[]',
  object: 'Record<string, unknown>',
};

/**
 * TS-тип поля с учётом начального значения.
 *
 * `null` в спеке — не опечатка, а штатное «пустое число»: валидаторы ядра (`min`, `max`, …)
 * объявлены как `TField extends number | null | undefined` и пустое значение пропускают,
 * обязательность даёт `required()`. Без расширения типа сгенерированный `model.ts` не
 * компилировался бы сам по себе: `initialFormModel` присваивал бы `null` полю `number`.
 */
function fieldTsType(field: FieldIntent): string {
  const base = TS_TYPE[field.type] ?? 'unknown';
  if (field.initialValue !== null) return base;
  return base.includes('null') ? base : `${base} | null`;
}

/** Литерал начального значения по типу поля. */
function initialLiteral(field: FieldIntent): string {
  if (field.initialValue !== undefined) return JSON.stringify(field.initialValue);
  switch (field.type) {
    case 'number':
      return '0';
    case 'boolean':
      return 'false';
    case 'date':
      return 'null';
    case 'array':
      return '[]';
    case 'object':
      return '{}';
    default:
      return "''";
  }
}

// ---------------------------------------------------------------------------
// model.ts
// ---------------------------------------------------------------------------

export function buildModelTs(intent: FormIntent): string {
  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Модель формы «${intent.formName}» — источник истины для всех остальных файлов.`);
  lines.push(' * Валидация, поведение и схема ссылаются на ЭТИ пути; менять их надо здесь.');
  lines.push(' */');
  lines.push(
    intent.arrays.length > 0
      ? "import { arrayOf, createModel } from '@reformer/core';"
      : "import { createModel } from '@reformer/core';"
  );
  lines.push('');

  // Типы элементов массивов объявляются до основного — иначе ссылка вперёд.
  //
  // `type`, а не `interface`: правило корпуса (core «TYPE-SAFETY RECIPES» Recipe 2,
  // reformer://guide §27). У interface нет неявной индексной сигнатуры, поэтому он не
  // присваивается `Record<string, FormValue>` — а на это ограничение опираются `FormProxy<T>`,
  // `ArrayNode<T>` и generic-constraint `FormWizard<T>`. Сервер, печатающий interface, нарушал
  // собственное правило и отдавал консументу тип, который тот потом менял руками.
  for (const arr of intent.arrays) {
    lines.push(`export type ${arr.itemInterfaceName} = {`);
    for (const f of arr.itemFields) {
      if (f.label) lines.push(`  /** ${f.label} */`);
      lines.push(`  ${f.name}: ${fieldTsType(f)};`);
    }
    lines.push('};');
    lines.push('');
  }

  const tree = modelTree(intent);

  lines.push(`export type ${intent.interfaceName} = {`);
  lines.push(...renderShape(tree, 1));
  lines.push('};');
  lines.push('');

  // Шаблон нового элемента живёт в модели, рядом с начальными значениями: `arrayOf(blank)`
  // объявляет и массив, и то, чем его пополняет кнопка «Добавить». Узлу массива в схеме
  // `initialValue` после этого не нужен — и разойтись с моделью ему не с чем.
  for (const arr of intent.arrays) {
    lines.push(`/** Шаблон нового элемента массива \`${arr.modelPath ?? arr.name}\`. */`);
    lines.push(`const ${blankName(arr)} = (): ${arr.itemInterfaceName} => ({`);
    // Значения — те же, что дал бы тип поля в корне модели: шаблон обязан подходить под
    // тип элемента, а `null` для числа без `| null` в типе не собрался бы.
    for (const f of arr.itemFields) {
      lines.push(`  ${objectKey(f.name)}: ${initialLiteral(f)},`);
    }
    lines.push('});');
    lines.push('');
  }

  // Фабрика, а не константа с начальными значениями: модель — по одной на сборку, и общий
  // объект между двумя формами на странице делил бы состояние.
  lines.push(
    '/** Модель формы — по одной на сборку: `createForm({ model: createFormModel(), … })`. */'
  );
  lines.push('export const createFormModel = () =>');
  lines.push(`  createModel<${intent.interfaceName}>({`);
  lines.push(...renderInitial(tree, 2));
  lines.push('  });');
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// index.tsx — сборка
// ---------------------------------------------------------------------------

/** Имя React-компонента формы: `LoanRequest` → `LoanRequestForm`, без удвоения `FormForm`. */
function formComponentName(intent: FormIntent): string {
  return /Form$/.test(intent.interfaceName) ? intent.interfaceName : `${intent.interfaceName}Form`;
}

/**
 * Сборка формы — тело `index.tsx`.
 *
 * Файл пишет консумент (в нём живут загрузка, submit и оформление страницы), поэтому в бандл он
 * не входит. Но именно здесь агенты чаще всего возвращались к прежнему контракту — три фабрики
 * сборки, два хука, отдельный рендерер для JSON, — и манифест без этого образца оставлял
 * единственный непокрытый файл на догадку. Сборка одна на все таргеты: меняется только вид
 * схемы (функция или документ + `registry`) и то, кто рисует разметку.
 */
export function buildAssemblyTsx(intent: FormIntent): string {
  const type = intent.interfaceName;
  const name = formComponentName(intent);
  const json = intent.target === 'renderer-json';
  const lines: string[] = [];

  lines.push("import { createForm, useFormBundle } from '@reformer/core';");
  if (intent.target !== 'core')
    lines.push("import { FormRenderer } from '@reformer/renderer-react';");
  if (intent.target === 'renderer-react')
    lines.push("import { FormField } from '@reformer/ui-kit';");
  lines.push("import { formBehavior } from './form.behavior';");
  lines.push("import { formSchema } from './form.schema';");
  lines.push("import { formValidation } from './form.validation';");
  lines.push(`import { createFormModel, type ${type} } from './model';`);
  if (json) lines.push("import { createRegistry } from './registry';");
  lines.push('');
  if (json) {
    // Реестр создаётся один раз на модуль: это код приложения, а не данные формы.
    lines.push('const registry = createRegistry();');
    lines.push('');
  }
  lines.push(`export function ${name}() {`);
  lines.push(
    '  // Фабрика выполняется один раз: `useMemo` здесь неверен — React вправе сбросить кэш.'
  );
  lines.push('  const bundle = useFormBundle(() =>');
  lines.push(`    createForm<${type}>({`);
  lines.push('      model: createFormModel(),');
  lines.push('      schema: formSchema,');
  if (json) lines.push('      registry,');
  lines.push('      behavior: formBehavior,');
  lines.push('      validation: formValidation,');
  lines.push('    })');
  lines.push('  );');
  lines.push('');
  if (intent.target === 'core') {
    lines.push('  // Разметку рисуете сами: поля — `bundle.form.<путь>`, например');
    lines.push('  // <FormField control={bundle.form.email} />. Правила узлов схемы (`hideWhen`)');
    lines.push('  // исполняет только рендерер — видимость здесь остаётся условием в JSX.');
    lines.push('  return null;');
  } else if (json) {
    lines.push('  // Обёртка поля приходит из реестра (`FIELD_WRAPPER`).');
    lines.push('  return <FormRenderer form={bundle} />;');
  } else {
    lines.push('  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;');
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

/** Имя фабрики шаблона элемента: `PropertyItem` → `blankPropertyItem`. */
function blankName(arr: ArrayIntent): string {
  return `blank${arr.itemInterfaceName}`;
}

/** Ключ объектного литерала: идентификатор как есть, прочее — в кавычках. */
function objectKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

/**
 * Узел дерева модели: либо лист (поле или массив), либо группа.
 *
 * Дерево нужно, потому что путь поля может быть составным — `personalData.lastName`. Плоский
 * рендер давал `personalData.lastName: string;`, а это неTypeScript вовсе: файл не собирался
 * у пользователя. Составные пути — не экзотика: в спеках проекта ими записаны целые разделы
 * (паспорт, персональные данные), и именно из-за них разбор спеки их молча выбрасывал.
 */
type ModelNode =
  | { kind: 'field'; field: FieldIntent }
  | { kind: 'array'; array: ArrayIntent }
  | { kind: 'group'; children: Map<string, ModelNode> };

function modelTree(intent: FormIntent): Map<string, ModelNode> {
  const root = new Map<string, ModelNode>();

  const put = (path: string, leaf: ModelNode) => {
    const parts = path.split('.').filter(Boolean);
    let level = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const existing = level.get(key);
      if (existing?.kind === 'group') {
        level = existing.children;
        continue;
      }
      // Скаляр и группа под одним именем — противоречие в самом intent. Побеждает группа:
      // без неё потерялись бы ВСЕ вложенные поля, а не одно.
      const group: ModelNode = { kind: 'group', children: new Map() };
      level.set(key, group);
      level = group.children;
    }
    const last = parts[parts.length - 1] ?? path;
    if (level.get(last)?.kind !== 'group') level.set(last, leaf);
  };

  // Массивы объявляются первыми: путь массива тоже может быть составным.
  for (const a of intent.arrays) put(a.modelPath ?? a.name, { kind: 'array', array: a });
  // Путь берётся тот же, что уходит в `$model(...)` разметки, иначе привязка ведёт в никуда.
  for (const f of intent.fields) put(f.modelPath ?? f.name, { kind: 'field', field: f });

  return root;
}

/** Тело интерфейса: группы разворачиваются во вложенные объекты. */
function renderShape(level: Map<string, ModelNode>, depth: number): string[] {
  const pad = '  '.repeat(depth);
  const out: string[] = [];
  for (const [key, node] of level) {
    if (node.kind === 'group') {
      out.push(`${pad}${key}: {`);
      out.push(...renderShape(node.children, depth + 1));
      out.push(`${pad}};`);
      continue;
    }
    if (node.kind === 'array') {
      out.push(`${pad}${key}: ${node.array.itemInterfaceName}[];`);
      continue;
    }
    if (node.field.label) out.push(`${pad}/** ${node.field.label} */`);
    out.push(`${pad}${key}: ${fieldTsType(node.field)};`);
  }
  return out;
}

/** Начальное значение — той же формы, что и интерфейс. */
function renderInitial(level: Map<string, ModelNode>, depth: number): string[] {
  const pad = '  '.repeat(depth);
  const out: string[] = [];
  for (const [key, node] of level) {
    if (node.kind === 'group') {
      out.push(`${pad}${key}: {`);
      out.push(...renderInitial(node.children, depth + 1));
      out.push(`${pad}},`);
      continue;
    }
    if (node.kind === 'array') {
      const rows = node.array.initialValue;
      const initial = rows.length > 0 ? `, ${JSON.stringify(rows)}` : '';
      out.push(`${pad}${key}: arrayOf(${blankName(node.array)}${initial}),`);
      continue;
    }
    out.push(`${pad}${key}: ${initialLiteral(node.field)},`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// form.validation.ts
// ---------------------------------------------------------------------------

/** Какие валидаторы реально использованы — импортируем ровно их. */
/**
 * Имя валидатора → его ВЫЗОВ.
 *
 * `@reformer/core/validators` экспортирует фабрики: `required` — функция, создающая правило,
 * а не само правило. Контракт `ValidationRuleIntent.rules` допускает обе записи (`required` и
 * `minLength(2)`), и раньше первая уходила в код как есть — то есть в `validate(…, [required])`,
 * который не компилируется. Путь «спека → бандл» этого не показывал: анализатор спек всегда
 * пишет со скобками. Показал агент, для которого `required` — самая естественная запись.
 */
function callValidator(rule: string): string {
  const trimmed = rule.trim();
  return /[()]/.test(trimmed) ? trimmed : `${trimmed}()`;
}

function collectValidators(rules: ValidationRuleIntent[]): string[] {
  const used = new Set<string>();
  for (const rule of rules) {
    for (const r of rule.rules) {
      const name = r.match(/^([A-Za-z_$][\w$]*)/)?.[1];
      if (name) used.add(name);
    }
  }
  return [...used].sort();
}

/** Параметры `buildValidationSchemaTs`: всё, что модуль берёт не из правил. */
export interface ValidationSchemaTsOptions {
  /** Тип модели — параметр `defineValidationSchema<…>`. */
  interfaceName: string;
  /** Имя экспортируемой константы схемы (`formValidation`, `stepValidation`, …). */
  exportName: string;
  /**
   * Откуда импортировать тип модели — спецификатор модуля как есть (`'./model'`, `'../../types'`).
   * Раскладка файлов — решение потребителя: MCP держит тип в `model.ts`, билдер — в `types.ts`,
   * а файл шага лежит двумя каталогами глубже корня.
   */
  typeImport: string;
  /**
   * Текст JSDoc-шапки модуля — строки без `/**`, ` * ` и `*\/`; перевод строки делит строки.
   * Без него модуль печатается без шапки.
   */
  header?: string;
}

/**
 * Валидаторы и операторы, которые реально нужны набору правил.
 *
 * Импортируется только использованное: проекты собираются с `noUnusedLocals`, и лишний импорт
 * «на всякий случай» не даст форме скомпилироваться. Поэтому набор считается по ТОМУ
 * подмножеству правил, которое печатается в модуль, — у файла шага он свой.
 */
function validationImports(rules: readonly ValidationRuleIntent[]): {
  ops: string[];
  validators: string[];
} {
  const ops = ['validate', 'defineValidationSchema'];
  if (rules.some((r) => r.async)) ops.push('validateAsync');
  if (rules.some((r) => r.when)) ops.push('validateWhen');
  if (rules.some((r) => r.each)) ops.push('each');
  return { ops, validators: collectValidators([...rules]) };
}

/** Одно правило intent → строки тела схемы (с отступом тела). */
function validationRuleBlock(rule: ValidationRuleIntent): string {
  const body: string[] = [];
  if (rule.rules.length > 0) {
    body.push(`validate(model.$.${rule.target}, [${rule.rules.map(callValidator).join(', ')}]);`);
  }
  if (rule.async) {
    body.push(`validateAsync(model.$.${rule.target}, [${rule.async}]);`);
  }
  let block = body.map((b) => `  ${b}`).join('\n');
  if (rule.when) {
    block = `  validateWhen(() => ${rule.when}, () => {\n${body.map((b) => `    ${b}`).join('\n')}\n  });`;
  }
  if (rule.each) {
    block = `  each(model.$.${rule.each}, (item) => {\n${body
      .map((b) => `    ${b.replace(`model.$.${rule.target}`, `item.$.${rule.target}`)}`)
      .join('\n')}\n  });`;
  }
  return block;
}

/**
 * Модуль с ОДНОЙ схемой валидации для заданного подмножества правил.
 *
 * Зачем отдельно от `buildValidationTs`. Билдер раскладывает правила визарда по шагам
 * (`steps/<slug>/form.validation.ts` — правила полей шага, корневой `form.validation.ts` — межшаговые),
 * и каждому файлу нужен свой полноценный модуль: свои импорты ровно под свои правила, своё имя
 * экспорта, свой путь до типа модели. Второй эмиттер правил в билдере разошёлся бы с этим на
 * первой же правке — поэтому печать тела живёт здесь одна, а `buildValidationTs` — обёртка над ней.
 *
 * Печатает `import …` + `export const <exportName> = defineValidationSchema<…>(…)` и ничего
 * сверх: сборка корня (`apply(...)`, `makeValidationConfig`) — дело потребителя.
 *
 * @example
 * buildValidationSchemaTs([{ target: 'email', rules: ['required', 'email()'] }], {
 *   interfaceName: 'Contacts',
 *   exportName: 'stepValidation',
 *   typeImport: '../../types',
 * });
 */
export function buildValidationSchemaTs(
  rules: readonly ValidationRuleIntent[],
  opts: ValidationSchemaTsOptions
): string {
  const { ops, validators } = validationImports(rules);

  const lines: string[] = [];
  if (opts.header !== undefined) {
    lines.push('/**');
    for (const line of opts.header.split('\n')) lines.push(line ? ` * ${line}` : ' *');
    lines.push(' */');
  }
  lines.push(`import { ${ops.join(', ')} } from '@reformer/core/validation';`);
  if (validators.length > 0) {
    lines.push(`import { ${validators.join(', ')} } from '@reformer/core/validators';`);
  }
  lines.push(`import type { ${opts.interfaceName} } from '${opts.typeImport}';`);
  lines.push('');
  lines.push(
    `export const ${opts.exportName} = defineValidationSchema<${opts.interfaceName}>(({ model }) => {`
  );

  if (rules.length === 0) {
    lines.push('  // Правил в intent не было — добавьте их здесь.');
  }
  for (const rule of rules) lines.push(validationRuleBlock(rule));

  lines.push('});');
  return lines.join('\n') + '\n';
}

/** `form.validation.ts` формы целиком: одна схема `formValidation` над всеми правилами intent. */
export function buildValidationTs(intent: FormIntent): string {
  return buildValidationSchemaTs(intent.validation, {
    interfaceName: intent.interfaceName,
    exportName: 'formValidation',
    typeImport: './model',
    header:
      `Валидация формы «${intent.formName}» — правила над МОДЕЛЬЮ, не в layout-схеме.\n` +
      'Запуск: validateModel(model, formValidation).',
  });
}

// ---------------------------------------------------------------------------
// form.validation.ts — единый контракт
// ---------------------------------------------------------------------------

/** Имя из ключа шага или имени массива → идентификатор с суффиксом: `loan` → `loanRules`. */
function identifierFrom(source: string, suffix: string, taken: Set<string>): string {
  const words = source.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const camel = words
    .map(
      (word, i) =>
        (i === 0 ? word.charAt(0).toLowerCase() : word.charAt(0).toUpperCase()) + word.slice(1)
    )
    .join('');
  const base = `${/^[A-Za-z_$]/.test(camel) ? camel : `step${camel}`}${suffix}`;
  let name = base;
  for (let i = 2; taken.has(name); i++) name = `${base}${i}`;
  taken.add(name);
  return name;
}

/** К какому шагу относится путь модели: поле, массив или поле подформы внутри шага. */
function stepOfPath(
  intent: FormIntent,
  steps: ReturnType<typeof collectSteps>
): Map<string, number> {
  const owner = new Map<string, number>();
  const walk = (node: LayoutNode, step: number, scope: string): void => {
    const absolute = (ref: string): string => (scope ? `${scope}.${ref}` : ref);
    if (node.kind === 'field' || node.kind === 'array') {
      const path = absolute(node.ref);
      const declared =
        node.kind === 'field'
          ? intent.fields.find((f) => f.name === path || (f.modelPath ?? f.name) === path)
          : intent.arrays.find((a) => a.name === path || (a.modelPath ?? a.name) === path);
      owner.set(declared?.modelPath ?? declared?.name ?? path, step);
      // Правило может адресовать и имя сущности, и её путь в модели.
      if (declared) owner.set(declared.name, step);
      return;
    }
    if (node.kind === 'part') {
      const part = intent.parts?.[node.part];
      if (part) walk(part, step, absolute(node.ref));
      return;
    }
    node.children.forEach((child) => walk(child, step, scope));
  };
  steps.forEach((step, index) => step.children.forEach((child) => walk(child, index, '')));
  return owner;
}

/** Тело схемы формы или шага: правила как есть. */
function ruleLines(rules: readonly ValidationRuleIntent[]): string[] {
  return rules.map((rule) => validationRuleBlock({ ...rule, each: undefined }));
}

/**
 * Тело схемы строки массива. Путь правила — от элемента: префикс с именем массива срезается.
 * Условие `when` в схему строки не идёт — оно записано над корневой моделью и оборачивает само
 * подключение схемы (см. `applyRowSchema`).
 */
function rowRuleLines(rules: readonly ValidationRuleIntent[], each: string): string[] {
  return rules.map((rule) =>
    validationRuleBlock({
      ...rule,
      each: undefined,
      when: undefined,
      target: rule.target.startsWith(`${each}.`) ? rule.target.slice(each.length + 1) : rule.target,
    })
  );
}

/** Схема правил строки массива и то, как она подключается. */
interface RowSchema {
  each: string;
  /** Путь массива в модели. */
  path: string;
  itemType: string;
  name: string;
  /** Условие активности — общее для всех правил этой схемы. */
  when?: string;
  rules: ValidationRuleIntent[];
}

/** Подключение схемы строки: `applyEach`, при условии — внутри `validateWhen`. */
function applyRowSchema(row: RowSchema): string {
  const call = `applyEach(model.$.${row.path}, ${row.name});`;
  return row.when ? `  validateWhen(() => ${row.when}, () => {\n    ${call}\n  });` : `  ${call}`;
}

/**
 * `form.validation.ts` единого контракта.
 *
 * Отличия от {@link buildValidationTs}:
 * - правила строк массива — отдельная схема над ЭЛЕМЕНТОМ, подключённая привязкой
 *   `applyEach(model.$.items, itemRules)`; у неё своя область, и `cross` внутри получает снимок
 *   строки;
 * - у формы с шагами правила разложены по шагам и уходят объектом `FormValidation`: ключ шага —
 *   `selector` узла шага в схеме, по нему визард находит правила шага. Шаг без правил объявлен
 *   явно (`null`), правила вне шагов — в `extras` (проверяются целиком, при отправке).
 */
export function buildFormValidationTs(intent: FormIntent): string {
  const taken = new Set<string>(['formValidation']);
  const rowRules = intent.validation.filter((rule) => rule.each);
  const formRules = intent.validation.filter((rule) => !rule.each);

  // Правила строк — по массивам, в порядке первого упоминания. Правила одного массива с разными
  // условиями `when` дают отдельные схемы: условие оборачивает подключение схемы целиком.
  const rowSchemas: RowSchema[] = [];
  for (const rule of rowRules) {
    const each = rule.each as string;
    let row = rowSchemas.find((r) => r.each === each && r.when === rule.when);
    if (!row) {
      const array = intent.arrays.find((a) => a.name === each || (a.modelPath ?? a.name) === each);
      row = {
        each,
        path: array?.modelPath ?? array?.name ?? each,
        itemType: array?.itemInterfaceName ?? 'Record<string, unknown>',
        name: identifierFrom(each.split('.').pop() ?? each, 'RowRules', taken),
        ...(rule.when ? { when: rule.when } : {}),
        rules: [],
      };
      rowSchemas.push(row);
    }
    row.rules.push(rule);
  }

  const steps = collectSteps(intent.layoutRoot);
  const owner = stepOfPath(intent, steps);
  const stepSchemas = steps.map((step, index) => ({
    key: stepKeyOf(step, index),
    name: identifierFrom(stepKeyOf(step, index), 'Rules', taken),
    rules: formRules.filter((rule) => owner.get(rule.target) === index),
    rows: rowSchemas.filter((row) => (owner.get(row.path) ?? owner.get(row.each)) === index),
  }));
  const placed = new Set(stepSchemas.flatMap((step) => [...step.rules, ...step.rows]));
  const restRules = formRules.filter((rule) => !placed.has(rule));
  const restRows = rowSchemas.filter((row) => !placed.has(row));
  const withSteps = steps.length > 0;

  const { ops, validators } = validationImports(formRules.concat(rowRules));
  const operators = ops.filter((op) => op !== 'each');
  if (rowSchemas.length > 0) operators.push('applyEach');

  const itemTypes = [...new Set(rowSchemas.map((row) => row.itemType))].filter(
    (type) => type !== 'Record<string, unknown>'
  );

  const schema = (name: string, type: string, body: string[], exported = false): string[] => [
    `${exported ? 'export ' : ''}const ${name} = defineValidationSchema<${type}>(({ model }) => {`,
    ...(body.length > 0 ? body : ['  // Правил в intent не было — добавьте их здесь.']),
    '});',
    '',
  ];
  const applyRows = (rows: RowSchema[]): string[] => rows.map(applyRowSchema);

  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Валидация формы «${intent.formName}» — правила над МОДЕЛЬЮ, не в схеме разметки.`);
  if (withSteps) {
    lines.push(' * Ключ шага — `selector` узла шага в схеме: по нему визард находит правила шага.');
  }
  lines.push(' * Подключение: createForm({ …, validation: formValidation }).');
  lines.push(' */');
  if (withSteps) lines.push("import type { FormValidation } from '@reformer/core';");
  lines.push(`import { ${operators.sort().join(', ')} } from '@reformer/core/validation';`);
  if (validators.length > 0) {
    lines.push(`import { ${validators.join(', ')} } from '@reformer/core/validators';`);
  }
  lines.push(`import type { ${[intent.interfaceName, ...itemTypes].join(', ')} } from './model';`);
  lines.push('');

  for (const row of rowSchemas) {
    lines.push(`/** Правила строки массива \`${row.path}\`: пути — от элемента. */`);
    lines.push(...schema(row.name, row.itemType, rowRuleLines(row.rules, row.each)));
  }

  if (!withSteps) {
    lines.push(
      ...schema(
        'formValidation',
        intent.interfaceName,
        [...ruleLines(formRules), ...applyRows(rowSchemas)],
        true
      )
    );
    return lines.join('\n').trimEnd() + '\n';
  }

  for (const step of stepSchemas) {
    if (step.rules.length === 0 && step.rows.length === 0) continue;
    lines.push(
      ...schema(step.name, intent.interfaceName, [
        ...ruleLines(step.rules),
        ...applyRows(step.rows),
      ])
    );
  }
  const hasExtras = restRules.length > 0 || restRows.length > 0;
  if (hasExtras) {
    const extrasName = identifierFrom('crossStep', 'Rules', taken);
    lines.push('/** Правила вне шагов: проверяются целиком, при отправке. */');
    lines.push(
      ...schema(extrasName, intent.interfaceName, [...ruleLines(restRules), ...applyRows(restRows)])
    );
    lines.push(`export const formValidation: FormValidation<${intent.interfaceName}> = {`);
    lines.push('  steps: {');
    for (const step of stepSchemas) lines.push(`    ${stepEntry(step)},`);
    lines.push('  },');
    lines.push(`  extras: ${extrasName},`);
    lines.push('};');
    return lines.join('\n') + '\n';
  }
  lines.push(`export const formValidation: FormValidation<${intent.interfaceName}> = {`);
  lines.push('  steps: {');
  for (const step of stepSchemas) lines.push(`    ${stepEntry(step)},`);
  lines.push('  },');
  lines.push('};');
  return lines.join('\n') + '\n';
}

/** Запись шага в `steps`: схема правил либо явное «правил нет». */
function stepEntry(step: { key: string; name: string; rules: unknown[]; rows: unknown[] }): string {
  const value = step.rules.length === 0 && step.rows.length === 0 ? 'null' : step.name;
  return `${objectKey(step.key)}: ${value}`;
}

// ---------------------------------------------------------------------------
// behavior.ts
// ---------------------------------------------------------------------------

/**
 * Имена параметров колбэка `computeFrom` из путей источников.
 *
 * Путь `personal.lastName` идентификатором не является: подставленный в список параметров как
 * есть, он давал `(personal.lastName) => …` — файл не парсится вовсе. Составные пути в intent —
 * норма (целые разделы спек записаны ими), а через `path` их присылает и модель, поэтому имя
 * берётся по последнему сегменту; совпадения разводятся индексом.
 */
function callbackParams(sources: readonly string[]): { params: string[]; renamed: string[] } {
  const used = new Set<string>();
  const params: string[] = [];
  const renamed: string[] = [];
  for (const source of sources) {
    const base = (source.split('.').pop() ?? source).replace(/[^A-Za-z0-9_$]/g, '') || 'value';
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}${i}`;
    used.add(name);
    params.push(name);
    if (name !== source) renamed.push(`${source} → ${name}`);
  }
  return { params, renamed };
}

function renderBehavior(b: BehaviorIntent): string {
  const target = `model.$.${b.target}`;
  const sources = b.sources.map((s) => `model.$.${s}`).join(', ');
  const opts = b.options ? `, ${JSON.stringify(b.options)}` : '';
  switch (b.kind) {
    case 'compute':
      return `  compute(${target}, () => ${b.expr ?? 'undefined'});`;
    case 'computeFrom': {
      const { params, renamed } = callbackParams(b.sources);
      // Переименование названо на месте: выражение писал консумент, и оно ссылается на
      // ИСХОДНЫЕ имена — без этой строки расхождение он нашёл бы только по ошибке компиляции.
      const note =
        renamed.length > 0
          ? `  // параметры названы по последнему сегменту: ${renamed.join(', ')}\n`
          : '';
      return `${note}  computeFrom([${sources}], ${target}, (${params.join(', ')}) => ${b.expr ?? 'undefined'});`;
    }
    case 'copyFrom':
      return `  copyFrom(model.$.${b.sources[0] ?? 'source'}, ${target}${opts});`;
    case 'syncFields':
      return `  syncFields(${target}, model.$.${b.sources[0] ?? 'other'}${opts});`;
    case 'onChange':
      return `  onChange(${target}, (value) => { ${b.expr ?? '/* эффект */'} }${opts});`;
    case 'enableWhen':
    case 'disableWhen':
      return `  ${b.kind}(${target}, () => ${b.expr ?? 'true'}${opts});`;
    case 'resetWhen':
      return `  resetWhen(${target}, () => ${b.expr ?? 'false'}${opts});`;
    case 'transformValue':
      return `  transformValue(${target}, (value) => ${b.expr ?? 'value'});`;
    case 'revalidateWhen':
      return `  revalidateWhen([${sources}], () => { ${b.expr ?? '/* перепроверка */'} });`;
    default:
      return `  // неизвестный вид поведения: ${String(b.kind)}`;
  }
}

export function buildBehaviorTs(intent: FormIntent): string {
  const ops = [...new Set(intent.behavior.map((b) => b.kind))].sort();
  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Поведение формы «${intent.formName}» — реактивные связи над моделью.`);
  lines.push(' */');
  lines.push(
    `import { defineFormBehavior${ops.length ? `, ${ops.join(', ')}` : ''} } from '@reformer/core/behaviors';`
  );
  lines.push(`import type { ${intent.interfaceName} } from './model';`);
  lines.push('');
  lines.push(
    `export const formBehavior = defineFormBehavior<${intent.interfaceName}>(({ model }) => {`
  );
  if (intent.behavior.length === 0) {
    lines.push('  // Поведения в intent не было — добавьте его здесь.');
  }
  for (const b of intent.behavior) lines.push(renderBehavior(b));
  lines.push('});');
  return lines.join('\n') + '\n';
}

/**
 * `form.behavior.ts` единого контракта: поведение формы одно — и связи над моделью, и правила
 * узлов схемы.
 *
 * Отличие от {@link buildBehaviorTs}: правила видимости (`intent.visibility`) печатаются здесь же,
 * оператором `hideWhen(schema.node(selector), условие)`, а не отдельным файлом слоя рендера.
 * Правила узлов исполняет рендерер, поэтому для таргета `core` (разметка в JSX) они не
 * печатаются — там видимость остаётся условием в компоненте.
 *
 * @returns Содержимое файла и предупреждения (правила видимости, опущенные для `core`).
 */
export function buildFormBehaviorTs(intent: FormIntent): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  const withNodes = intent.visibility.length > 0 && intent.target !== 'core';
  if (intent.visibility.length > 0 && !withNodes) {
    warnings.push(
      `Правил видимости: ${intent.visibility.length} — для таргета \`core\` они не напечатаны: ` +
        'правила узлов схемы исполняет рендерер, а здесь разметку рисует JSX. Запишите условия в ' +
        'компонентах шагов; чтобы поле при этом перестало валидироваться — `enableWhen`.'
    );
  }

  const ops = [...new Set<string>(intent.behavior.map((b) => b.kind))];
  if (withNodes) ops.push('hideWhen');
  ops.sort();

  const lines: string[] = [];
  lines.push('/**');
  lines.push(
    withNodes
      ? ` * Поведение формы «${intent.formName}» — связи над моделью и правила узлов схемы.`
      : ` * Поведение формы «${intent.formName}» — реактивные связи над моделью.`
  );
  if (withNodes) {
    lines.push(' * Скрытие узла НЕ убирает поле из модели: чтобы оно перестало валидироваться,');
    lines.push(' * рядом нужен enableWhen.');
  }
  lines.push(' */');
  lines.push(
    `import { defineFormBehavior${ops.length ? `, ${ops.join(', ')}` : ''} } from '@reformer/core/behaviors';`
  );
  lines.push(`import type { ${intent.interfaceName} } from './model';`);
  lines.push('');
  lines.push(
    `export const formBehavior = defineFormBehavior<${intent.interfaceName}>(({ ${
      withNodes ? 'model, schema' : 'model'
    } }) => {`
  );
  if (intent.behavior.length === 0 && !withNodes) {
    lines.push('  // Поведения в intent не было — добавьте его здесь.');
  }
  for (const b of intent.behavior) lines.push(renderBehavior(b));
  if (withNodes) {
    if (intent.behavior.length > 0) lines.push('');
    lines.push('  // Видимость узлов схемы — по `selector`.');
    for (const v of intent.visibility) {
      lines.push(`  hideWhen(schema.node('${v.selector}'), () => ${v.condition});`);
    }
  }
  lines.push('});');
  return { content: lines.join('\n') + '\n', warnings };
}

// ---------------------------------------------------------------------------
// layout: JSON (renderer-json) либо FormSchema (core / renderer-react)
// ---------------------------------------------------------------------------

interface JsonNode {
  selector?: string;
  value?: string;
  component?: string;
  componentProps?: Record<string, unknown>;
  children?: JsonNode[];
  array?: string;
  /** «Пустой» элемент для кнопки «Добавить» — ОБЪЕКТ по форме элемента, не массив строк. */
  initialValue?: Record<string, unknown>;
  /** Контракт renderer-json: шаблон элемента лежит под `$template`, а не в самом `item`. */
  item?: { $template: JsonNode };
}

/**
 * @param pathPrefix Путь до элемента массива, если поле лежит внутри него.
 */
function fieldNode(f: FieldIntent, pathPrefix?: string): JsonNode {
  const props: Record<string, unknown> = { ...(f.componentProps ?? {}) };
  if (f.label) props.label = f.label;
  // testId выводится из пути модели (точки → дефисы), а не из короткого имени поля.
  // Короткое имя не уникально: `properties[].type` и `existingLoans[].type` давали один и тот
  // же `type`, и генератор печатал два одинаковых идентификатора, отвечая «✅ проверка
  // пройдена». В браузере это strict mode violation — селектор разрешается в два элемента.
  // Индекс строки массива в путь не входит: его подставляет потребитель.
  props.testId =
    f.componentProps?.testId ??
    [pathPrefix, f.modelPath ?? f.name].filter(Boolean).join('.').replace(/\./g, '-');
  if (f.optionsSource) props.options = `$dataSource(${f.optionsSource})`;
  return {
    selector: f.selector ?? f.name,
    value: `$model(${f.modelPath ?? f.name})`,
    component: `$component(${f.component})`,
    componentProps: props,
  };
}

/**
 * «Пустой» элемент массива для кнопки «Добавить».
 *
 * `ArrayIntent.initialValue` — массив НАЧАЛЬНЫХ СТРОК, а `JsonArrayNode.initialValue` — литерал
 * ОДНОГО пустого элемента: имена совпали, смысл разный. Раньше массив уезжал в разметку как есть,
 * и renderer-json отвергал схему («initialValue must be object»), но узнавал об этом только
 * пользователь: `crossCheckBundle` структуру узлов не знает и печатала «✅ пройдена».
 *
 * Образец берётся из первой строки, если она там есть, — она уже по форме элемента. Иначе
 * собирается из `itemFields`: пустой элемент нужен даже тогда, когда начальных строк нет.
 */
function emptyItem(a: ArrayIntent): Record<string, unknown> {
  const sample = a.initialValue.find(
    (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  );
  if (sample) return sample as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  // `initialValue` самого поля важнее пустышки по типу: intent, где у элемента заданы
  // `{ type: 'apartment', estimatedValue: 0 }`, раньше давал `{ type: '', estimatedValue: null }` —
  // значения молча терялись, и новая строка массива открывалась не в том состоянии.
  for (const f of a.itemFields) {
    out[f.name] = f.initialValue !== undefined ? f.initialValue : emptyValue(f.type);
  }
  return out;
}

/** Пустое значение по типу поля — то, с чего начинается новая строка массива. */
function emptyValue(type: FieldType): unknown {
  switch (type) {
    case 'number':
      return null;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return '';
  }
}

function layoutToJson(node: LayoutNode, intent: FormIntent): JsonNode | null {
  switch (node.kind) {
    // Подформ в прежнем формате нет — узел опускается (их печатает разметка формата 2).
    case 'part':
      return null;
    case 'field': {
      const f = intent.fields.find((x) => x.name === node.ref);
      return f ? fieldNode(f) : null;
    }
    case 'array': {
      const a = intent.arrays.find((x) => x.name === node.ref);
      if (!a) return null;
      return {
        // Заданный в layoutRoot `selector` побеждает имя массива: молчаливая подмена ломала
        // адресацию из behavior/visibility (те ссылаются на selector, которого в разметке
        // после подмены не оказывалось — и кросс-проверка выдавала C6 на собственный вывод).
        selector: node.selector ?? a.name,
        array: `$model(${a.modelPath ?? a.name})`,
        component: `$component(${a.component ?? 'FormArray'})`,
        initialValue: emptyItem(a),
        item: {
          $template: {
            component: '$html(div)',
            // Префикс — имя массива: иначе одноимённые листья разных массивов дают
            // одинаковый testId (в замере так столкнулись properties[].type и
            // existingLoans[].type).
            children: a.itemFields.map((f) => fieldNode(f, a.name)),
          },
        },
      };
    }
    case 'step':
      return {
        selector: node.selector,
        component: '$component(Step)',
        componentProps: { title: node.title },
        children: node.children
          .map((c) => layoutToJson(c, intent))
          .filter((c): c is JsonNode => c !== null),
      };
    default: {
      const steps = node.children.filter((c) => c.kind === 'step');

      // Контейнер, детьми которого являются шаги, — это wizard. В JSON-DSL шаги живут в
      // `componentProps.steps`, а НЕ в `children`: класть их в children — анти-паттерн,
      // названный так в самом корпусе (renderer-json, «Anti-patterns»). Конвертер резолвит
      // вложенные ноды внутри componentProps рекурсивно, поэтому форма валидна.
      // Компонент — `Wizard`: библиотека визарда не экспортирует, приложение регистрирует
      // под этим именем свой шим (см. канон раскладки, `wizard.tsx`).
      if (steps.length > 0 && steps.length === node.children.length) {
        return {
          selector: node.selector ?? 'wizard',
          component: '$component(Wizard)',
          componentProps: {
            ...node.componentProps,
            steps: steps
              .map((c) => layoutToJson(c, intent))
              .filter((c): c is JsonNode => c !== null),
          },
        };
      }

      return {
        selector: node.selector,
        component: node.htmlTag ? `$html(${node.htmlTag})` : `$component(${node.component})`,
        componentProps: node.componentProps,
        children: node.children
          .map((c) => layoutToJson(c, intent))
          .filter((c): c is JsonNode => c !== null),
      };
    }
  }
}

export function buildLayoutJson(intent: FormIntent): string {
  const root = layoutToJson(intent.layoutRoot, intent) ?? { component: '$html(div)', children: [] };
  return JSON.stringify({ version: '1.0', root }, null, 2) + '\n';
}

/**
 * `form.schema.ts` для renderer-json — тот же JSON-DSL, обёрнутый в `defineJsonSchema<T>`.
 *
 * Канонический дефолт схемы для renderer-json именно такой, а не чистый `.json`: хелпер сужает
 * пути `$model(...)` до `Path<T>`, и опечатка в пути становится ошибкой компиляции. У чистого
 * JSON этой проверки нет, и заменить её нечем — ни ajv, ни обход реестра неправильный путь
 * не ловят. Раньше генератор печатал `.json` с предупреждением в шапке; предупреждение читают
 * не все, а блок кода копируют все — поэтому дефолтом отдаётся `.ts`.
 */
export function buildRendererSchemaTs(intent: FormIntent): string {
  const literal = buildLayoutJson(intent).trimEnd();
  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Разметка формы «${intent.formName}» в JSON-DSL.`);
  lines.push(' *');
  lines.push(' * Обёртка `defineJsonSchema<T>` — не украшение: она типизирует литерал по модели,');
  lines.push(' * поэтому опечатка внутри `$model(...)` не собирается, а не всплывает в рантайме.');
  lines.push(' */');
  lines.push("import { defineJsonSchema } from '@reformer/renderer-json';");
  lines.push('');
  lines.push(`import type { ${intent.interfaceName} } from './model';`);
  lines.push('');
  lines.push(`export const formSchema = defineJsonSchema<${intent.interfaceName}>(${literal});`);
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// registry.ts (только renderer-json)
// ---------------------------------------------------------------------------

/**
 * Имя в схеме → импорт из ui-kit. Таблица полей сверена с `x-exportName` каталога ui-kit
 * (см. `ui-kit-components.ts`); неизвестное имя даёт TODO + warning.
 */
const COMPONENT_IMPORTS: Readonly<Record<string, string>> = {
  ...UI_KIT_FIELD_EXPORTS,
  ...UI_KIT_CONTAINER_EXPORTS,
  // Визард — библиотечный компонент ui-kit: шаги он берёт из узлов-детей, форму и валидацию —
  // из сборки. Прикладной шим под именем `Wizard` больше не нужен.
  FormWizard: 'FormWizard',
};

/**
 * Все имена `$component(...)`, которые появятся в layout.
 *
 * Обходит дерево, а не только список полей: контейнеры (`Box`, `Section`) и шаги задаются
 * в `layoutRoot` и в реестр обязаны попасть так же, как поля. Первая версия их пропускала —
 * кросс-проверка честно ловила это как C2 «`$component(Box)` не объявлен», и лечить надо было
 * не проверку, а генератор. Одна функция на оба потребителя (реестр и C2), чтобы они не
 * разошлись в понимании «что используется».
 */
export function collectUsedComponents(intent: FormIntent): Set<string> {
  const used = new Set<string>();
  for (const f of intent.fields) used.add(f.component);
  for (const a of intent.arrays) {
    used.add(a.component ?? 'FormArray');
    for (const f of a.itemFields) used.add(f.component);
  }
  const walk = (node: LayoutNode) => {
    if (node.kind === 'container') {
      const steps = node.children.filter((c) => c.kind === 'step');
      // Контейнер из одних шагов — визард: его рисует библиотечный `FormWizard`, а не компонент
      // из intent (см. `buildSchemaLayout`).
      if (steps.length > 0 && steps.length === node.children.length) used.add('FormWizard');
      // `htmlTag` рендерится через `$html(...)` и регистрации не требует.
      else if (!node.htmlTag) used.add(node.component);
      node.children.forEach(walk);
    } else if (node.kind === 'step') {
      used.add('Step');
      node.children.forEach(walk);
    }
  };
  walk(intent.layoutRoot);
  for (const part of Object.values(intent.parts ?? {})) walk(part);
  return used;
}

/** Компоненты реестра не из ui-kit: откуда их импортировать. */
const EXTRA_REGISTRY_IMPORTS: Readonly<Record<string, string>> = {
  Step: '@reformer/cdk/form-wizard',
};

export function buildRegistryTs(intent: FormIntent): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  const used = collectUsedComponents(intent);
  const extra = [...used].filter((c) => EXTRA_REGISTRY_IMPORTS[c]).sort();
  for (const c of extra) used.delete(c);

  const known = [...used].filter((c) => COMPONENT_IMPORTS[c]).sort();
  const unknown = [...used].filter((c) => !COMPONENT_IMPORTS[c]).sort();
  for (const c of unknown) {
    warnings.push(
      `Компонент \`${c}\` не в курируемой таблице импортов — в registry.ts стоит TODO.`
    );
  }

  const imports = [...new Set(known.map((c) => COMPONENT_IMPORTS[c]))].sort();
  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Реестр компонентов формы «${intent.formName}»: что рендерить под каждый`);
  lines.push(' * `$component(...)` из layout-схемы. Новый компонент в схеме → регистрация здесь.');
  lines.push(' */');
  for (const c of extra) lines.push(`import { ${c} } from '${EXTRA_REGISTRY_IMPORTS[c]}';`);
  lines.push(`import { ${['FormField', ...imports].join(', ')} } from '@reformer/ui-kit';`);
  lines.push(
    "import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';"
  );
  lines.push('');
  lines.push('export function createRegistry(): ComponentRegistry {');
  lines.push('  return defineRegistry((reg) => {');
  lines.push('    // Системная обёртка листа: label + ошибки. Сборка кладёт её в бандл формы.');
  lines.push('    reg.component(FIELD_WRAPPER, FormField);');
  for (const c of extra) lines.push(`    reg.component('${c}', ${c});`);
  for (const c of known) lines.push(`    reg.component('${c}', ${COMPONENT_IMPORTS[c]});`);
  for (const c of unknown) lines.push(`    // TODO: reg.component('${c}', /* импорт */);`);
  for (const ds of intent.dataSources) {
    lines.push(`    // TODO: reg.dataSource('${ds.name}', /* значения */);`);
  }
  lines.push('  });');
  lines.push('}');
  return { content: lines.join('\n') + '\n', warnings };
}

// ---------------------------------------------------------------------------
// render-behavior (видимость и wizard)
// ---------------------------------------------------------------------------

export function buildRenderBehaviorTs(intent: FormIntent): string {
  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Render-поведение формы «${intent.formName}» — правила над деревом разметки`);
  lines.push(' * по `selector` из layout-схемы. Скрытие узла НЕ убирает поле из модели:');
  lines.push(
    ' * если оно должно перестать валидироваться, используйте enableWhen в form.behavior.ts.'
  );
  lines.push(' */');
  lines.push("import { hideWhen, type RenderBehaviorFn } from '@reformer/renderer-react';");
  lines.push(`import type { ${intent.interfaceName} } from './model';`);
  lines.push('');
  lines.push(
    `export const formRenderBehavior: RenderBehaviorFn<${intent.interfaceName}> = (schema) => {`
  );
  if (intent.visibility.length === 0) {
    lines.push('  // Правил видимости в intent не было.');
  }
  for (const v of intent.visibility) {
    lines.push(`  hideWhen(schema.node('${v.selector}'), () => ${v.condition});`);
  }
  lines.push('};');
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Канон раскладки файлов
// ---------------------------------------------------------------------------

/** Один файл канонической раскладки модуля формы. */
export interface LayoutFileSpec {
  /**
   * Каноничное имя. Для `scope: 'step'` — имя ВНУТРИ папки шага (`form.validation.ts`), для
   * остальных — путь от корня модуля (`index.tsx`, `steps/index.ts`).
   */
  path: string;
  /** Зачем файл нужен — одной строкой. */
  role: string;
  /** Допустимые варианты имени/расширения (первым — то, что печатает генератор). */
  variants?: string[];
  /** Файл появляется не всегда. */
  optional?: boolean;
  /**
   * Где файл живёт: `root` (по умолчанию) — в корне модуля или по пути от корня, `step` — в
   * каждой папке шага `steps/<slug>/`. Имена внутри папки шага те же, что в корне: роль
   * называет суффикс, а не место.
   */
  scope?: 'root' | 'step';
}

/** Роль `form.behavior.ts` — одна на все таргеты: поведение формы единственное. */
const BEHAVIOR_ROLE =
  'поведение формы: связи над моделью (computeFrom / enableWhen / copyFrom) и правила узлов схемы (hideWhen по selector)';

/**
 * Каноническая раскладка по таргетам — источник `06-form-directory-layout.md` §1.
 *
 * Таблица живёт рядом с генератором намеренно. Манифест — один из немногих каналов, по которым
 * имена файлов доезжают до консумента без чтения документации целиком; замер
 * (`docs/plans/mcp-layout-authority.md`) показал, что агент, работающий точечными запросами,
 * правило раскладки не получает вовсе, а манифест печатал 5 имён из 10 и ничем не сообщал, что
 * остальные консумент обязан создать сам. Поэтому список печатается ПОЛНЫЙ, с пометкой
 * происхождения у каждой строки.
 *
 * Правило имён одно на все таргеты: `form.<роль>` — артефакт формы, суффикс называет роль
 * (`schema` — схема формы, `behavior` — поведение, `validation` — правила валидации); остальные
 * файлы без префикса. Набор файлов у таргетов один и тот же: схема одна, поведение одно, сборка
 * одна. renderer-json добавляет только `registry.ts`.
 *
 * Прежние имена принимаются валидатором с предупреждением (`LEGACY_STEMS` в `validate/layout.ts`):
 * слой рендера `renderer.*`, `validation.ts` без префикса, а также `form.render.ts` и `wizard.tsx`
 * прежнего контракта — правила узлов переехали в `form.behavior.ts`, визард стал библиотечным.
 */
export const FORM_LAYOUT_CANON: Record<ReformerTargetStack, LayoutFileSpec[]> = {
  core: [
    { path: 'index.tsx', role: 'точка входа: сборка `createForm` и разметка в JSX' },
    { path: 'types.ts', role: 'локальные типы модуля' },
    { path: 'model.ts', role: 'интерфейс модели, начальные значения и шаблоны элементов массивов' },
    {
      path: 'form.schema.ts',
      role: 'схема формы в TS: по ней сборка строит форму; разметку рисует JSX',
      variants: ['form.schema.tsx'],
    },
    { path: 'form.behavior.ts', role: BEHAVIOR_ROLE },
    { path: 'form.validation.ts', role: 'правила валидации' },
    { path: 'data-sources.ts', role: 'справочники и списки значений' },
    { path: 'api.ts', role: 'загрузка и submit' },
  ],
  'renderer-react': [
    { path: 'index.tsx', role: 'точка входа: сборка `createForm` и `FormRenderer`' },
    { path: 'types.ts', role: 'локальные типы модуля' },
    { path: 'model.ts', role: 'интерфейс модели, начальные значения и шаблоны элементов массивов' },
    {
      path: 'form.schema.ts',
      role: 'схема формы в TS: одно дерево на форму и на разметку (`.tsx`, если внутри есть JSX)',
      variants: ['form.schema.tsx'],
    },
    { path: 'form.behavior.ts', role: BEHAVIOR_ROLE },
    { path: 'form.validation.ts', role: 'правила валидации' },
    { path: 'data-sources.ts', role: 'справочники и списки значений' },
    { path: 'api.ts', role: 'загрузка и submit' },
  ],
  'renderer-json': [
    { path: 'index.tsx', role: 'точка входа: сборка `createForm` и `FormRenderer`' },
    { path: 'types.ts', role: 'локальные типы модуля' },
    { path: 'model.ts', role: 'интерфейс модели, начальные значения и шаблоны элементов массивов' },
    {
      path: 'form.schema.ts',
      role: 'схема в JSON-DSL формата 2 через `defineJsonSchema<T>` — с ним пути `$model(...)` проверяются на компиляции, с чистым `.json` нет',
      variants: ['form.schema.tsx', 'form.schema.json'],
    },
    { path: 'form.behavior.ts', role: BEHAVIOR_ROLE },
    { path: 'form.validation.ts', role: 'правила валидации' },
    { path: 'data-sources.ts', role: 'справочники и списки значений' },
    { path: 'api.ts', role: 'загрузка и submit' },
    { path: 'registry.ts', role: 'реестр: `$component(...)` → React-компонент' },
  ],
};

/** Каталог шагов визарда и его агрегатор — одни на все таргеты. */
export const STEPS_DIR = 'steps';

/** Файлы папки шага — одни на все таргеты; у renderer-json схема шага может быть и `.json`. */
function stepLayout(schemaVariants: string[]): LayoutFileSpec[] {
  return [
    {
      path: 'steps/index.ts',
      role: 'агрегатор шагов: порядок шагов и их схемы',
      optional: true,
    },
    {
      path: 'form.validation.ts',
      role: 'правила полей шага (межшаговые — в корневом `form.validation.ts`)',
      optional: true,
      scope: 'step',
    },
    {
      path: 'form.schema.ts',
      role: 'схема шага: узел `Step` с полями; встаёт в `children` визарда',
      variants: schemaVariants,
      optional: true,
      scope: 'step',
    },
    {
      path: 'form.behavior.ts',
      role: 'поведение в пределах шага (межшаговое — в корневом `form.behavior.ts`)',
      optional: true,
      scope: 'step',
    },
  ];
}

/**
 * Раскладка визарда по шагам — опциональная надстройка над `FORM_LAYOUT_CANON`.
 *
 * Шаги можно держать в корневой схеме (и тогда этих файлов нет вовсе), а можно — по папке на
 * шаг: `steps/<slug>/`, где `<slug>` — kebab-слаг заголовка шага БЕЗ номера (порядок задаёт
 * агрегатор `steps/index.ts`, поэтому перестановка шагов папки не трогает). Внутри папки шага имена те же,
 * что в корне: `form.schema.*` — схема шага, `form.validation.ts` — правила полей шага,
 * `form.behavior.ts` — поведение шага. Межшаговое остаётся в корневых файлах.
 *
 * Все записи опциональны: обязательность шагов проверять нечем — сколько их и есть ли они,
 * знает только форма.
 */
export const STEP_LAYOUT_CANON: Record<ReformerTargetStack, LayoutFileSpec[]> = {
  core: stepLayout(['form.schema.tsx']),
  'renderer-react': stepLayout(['form.schema.tsx']),
  'renderer-json': stepLayout(['form.schema.tsx', 'form.schema.json']),
};

/** Путь файла шага от корня модуля: `steps/<slug>/<file>` для `scope: 'step'`. */
export function layoutSpecPath(spec: LayoutFileSpec, slug = '<slug>'): string {
  return spec.scope === 'step' ? `${STEPS_DIR}/${slug}/${spec.path}` : spec.path;
}

/**
 * Тот же канон одной строкой — для каналов, где таблица `renderLayoutChecklist` не по бюджету.
 *
 * Такие каналы уже два: результат `plan_form` и сборка `get_context`. Строка собирается из
 * `FORM_LAYOUT_CANON`, а не пишется руками, иначе копии расходятся с каноном — ровно эта
 * поломка и разбирается в `docs/plans/mcp-layout-authority.md`.
 *
 * @param withOptional - Дописать опциональные файлы и раскладку шагов. По умолчанию нет: в
 *   `plan_form` строка отвечает на «какие файлы завести сейчас». В `get_context` — да: там она
 *   единственный источник имён, а файлы `steps/<slug>/` — как раз те имена, которые агенты
 *   выдумывали сами (`components/steps/Step1.tsx`).
 */
export function renderLayoutLine(target: ReformerTargetStack, withOptional = false): string {
  const canon = FORM_LAYOUT_CANON[target];
  const files = canon
    .filter((f) => !f.optional)
    .map((f) => `\`${f.path}\``)
    .join(' ');
  const optional = withOptional
    ? [
        ...canon.filter((f) => f.optional).map((f) => f.path),
        ...STEP_LAYOUT_CANON[target].map((f) => layoutSpecPath(f)),
      ]
        .map((p) => `\`${p}\``)
        .join(' ')
    : '';
  return (
    `Файлы модуля (${target}, плоский модуль; шаги wizard-а — в корневой схеме или в \`steps/<slug>/\`): ${files}` +
    (optional ? ` (+ по необходимости ${optional})` : '') +
    '. Правило — `find_recipe directory-layout`, сверка имён — `validate_form kind="layout"`.'
  );
}

/** Имя файла с вариантами — `` `a` (или `b`, `c`) ``. */
function specNames(spec: LayoutFileSpec, path = spec.path): string {
  const variants = spec.variants ?? [];
  return variants.length === 0
    ? `\`${path}\``
    : `\`${path}\` (или ${variants.map((v) => `\`${v}\``).join(', ')})`;
}

/**
 * Раскладка шагов одной строкой — чтобы агент, решивший разнести визард по файлам, взял
 * канонические имена, а не `components/steps/Step1.tsx`.
 */
export function renderStepLayoutNote(target: ReformerTargetStack): string {
  const canon = STEP_LAYOUT_CANON[target];
  const index = canon.filter((f) => f.scope !== 'step').map((f) => `\`${f.path}\``);
  const inStep = canon.filter((f) => f.scope === 'step').map((f) => specNames(f));
  return (
    `Wizard по шагам (опционально): ${index.join(', ')} + папка на шаг \`${STEPS_DIR}/<slug>/\` ` +
    `(kebab-слаг заголовка без номера) с файлами ${inStep.join(', ')}. ` +
    'Межшаговое — в корневых файлах; иной вложенности канон не предусматривает.'
  );
}

/**
 * Полный per-target список имён с пометкой, что сгенерировано, а что консумент пишет сам.
 *
 * Печатается ВСЕГДА, даже когда сгенерировано всё: молчание манифеста читается как «файлов
 * ровно столько», и именно так раскладка расходилась с каноном на практике.
 */
export function renderLayoutChecklist(
  target: ReformerTargetStack,
  generated: readonly string[]
): string {
  const canon = FORM_LAYOUT_CANON[target];
  const emitted = new Set(generated);

  const lines: string[] = [];
  lines.push('## Раскладка модуля — канонические имена');
  lines.push('');
  lines.push(
    'Модуль формы плоский: без `lib/` / `schema/` / `components/steps/`; шаги wizard-а — ' +
      'в корневой схеме или по папке на шаг `steps/<slug>/` (имена внутри те же). ' +
      'Префикс `form.` — у артефактов формы, суффикс называет роль (`schema` — схема формы, ' +
      '`behavior` — поведение формы: модель и узлы схемы, `validation` — валидация); ' +
      'остальные файлы plain-named. Полное правило — `find_recipe directory-layout`.'
  );
  lines.push('');

  const rows: string[] = [];
  let required = 0;
  let done = 0;
  for (const spec of canon) {
    const hit = [spec.path, ...(spec.variants ?? [])].find((p) => emitted.has(p));
    if (!spec.optional) required += 1;
    let origin: string;
    if (hit) {
      if (!spec.optional) done += 1;
      origin = hit === spec.path ? 'сгенерирован ниже' : `сгенерирован ниже как \`${hit}\``;
    } else {
      origin = spec.optional ? 'создайте сами, если нужен' : '**создайте сами**';
    }
    rows.push(`| ${specNames(spec)} | ${spec.role} | ${origin} |`);
  }

  lines.push(
    `Сервер сгенерировал ${done} из ${required} обязательных файлов; остальные создайте сами — ` +
      'под этими именами, а не под своими.'
  );
  lines.push('');
  lines.push('| Файл | Роль | Откуда |');
  lines.push('| --- | --- | --- |');
  lines.push(...rows);

  lines.push('');
  lines.push(renderStepLayoutNote(target));

  lines.push('');
  lines.push(
    'Когда состав файлов известен, сверьте его: `validate_form kind="layout"` со списком имён.'
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Сборка манифеста
// ---------------------------------------------------------------------------

/**
 * Файлы бандла для целевого стека — единый контракт формы.
 *
 * Раскладка — плоская (`minimalist`); артефакты формы названы `form.<роль>` (`form.schema`,
 * `form.behavior`, `form.validation`), остальные файлы — без префикса. Правило имён и набор
 * файлов одни на все таргеты (`FORM_LAYOUT_CANON`).
 *
 * Схема печатается для каждого таргета: в TS (`core`, `renderer-react`) либо документом JSON-DSL
 * формата 2 (`renderer-json`) — это одно и то же дерево в двух записях (`schema-emit.ts`).
 * Правила видимости уходят в `form.behavior.ts`, отдельного файла слоя рендера нет.
 *
 * Генерируется ПОДМНОЖЕСТВО набора: остальные файлы (`index.tsx`, `types.ts`, `data-sources.ts`,
 * `api.ts`) пишет консумент. Полный набор с пометкой происхождения печатает
 * `renderLayoutChecklist` — без неё манифест читался как «файлов ровно столько», и имена
 * расходились с каноном.
 */
export function buildBundle(intent: FormIntent): {
  files: BundleFile[];
  warnings: string[];
  /** Схема как чистый JSON (документ формата 2) — для кросс-проверки. */
  layoutJson: string;
} {
  const warnings: string[] = [];
  const layoutJson = buildFormSchemaJson(intent);
  const behavior = buildFormBehaviorTs(intent);
  warnings.push(...behavior.warnings);

  const files: BundleFile[] = [
    { path: 'model.ts', content: buildModelTs(intent) },
    { path: 'form.validation.ts', content: buildFormValidationTs(intent) },
    { path: 'form.behavior.ts', content: behavior.content },
  ];

  if (intent.target === 'renderer-json') {
    // Отдаём канонический `.ts` (`defineJsonSchema<T>`), а не чистый `.json`: только он держит
    // compile-time проверку путей `$model(...)` — ни ajv, ни обход реестра опечатку в пути не
    // ловят.
    files.push({ path: 'form.schema.ts', content: buildFormSchemaJsonTs(intent) });
    const registry = buildRegistryTs(intent);
    files.push({ path: 'registry.ts', content: registry.content });
    warnings.push(...registry.warnings);
    warnings.push(...buildSchemaLayout(intent).warnings);
  } else {
    // core и renderer-react получают ту же схему в TS: узлы держат ручки модели (`model.$.…`)
    // и сами компоненты, а не их имена.
    const schema = buildFormSchemaTs(intent);
    files.push({ path: 'form.schema.ts', content: schema.content });
    warnings.push(...schema.warnings);
  }

  return { files, warnings, layoutJson };
}
