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
  lines.push(' * Валидация, поведение и layout ссылаются на ЭТИ пути; менять их надо здесь.');
  lines.push(' */');
  lines.push('');

  // Интерфейсы элементов массивов объявляются до основного — иначе ссылка вперёд.
  for (const arr of intent.arrays) {
    lines.push(`export interface ${arr.itemInterfaceName} {`);
    for (const f of arr.itemFields) {
      if (f.label) lines.push(`  /** ${f.label} */`);
      lines.push(`  ${f.name}: ${fieldTsType(f)};`);
    }
    lines.push('}');
    lines.push('');
  }

  const tree = modelTree(intent);

  lines.push(`export interface ${intent.interfaceName} {`);
  lines.push(...renderShape(tree, 1));
  lines.push('}');
  lines.push('');

  lines.push(`export const initialFormModel: ${intent.interfaceName} = {`);
  lines.push(...renderInitial(tree, 1));
  lines.push('};');
  return lines.join('\n') + '\n';
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
      out.push(`${pad}${key}: ${JSON.stringify(node.array.initialValue)},`);
      continue;
    }
    out.push(`${pad}${key}: ${initialLiteral(node.field)},`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// validation.ts
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

export function buildValidationTs(intent: FormIntent): string {
  const validators = collectValidators(intent.validation);
  const usesAsync = intent.validation.some((r) => r.async);
  const usesWhen = intent.validation.some((r) => r.when);
  const usesEach = intent.validation.some((r) => r.each);

  const ops = ['validate', 'defineValidationSchema'];
  if (usesAsync) ops.push('validateAsync');
  if (usesWhen) ops.push('validateWhen');
  if (usesEach) ops.push('each');

  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Валидация формы «${intent.formName}» — правила над МОДЕЛЬЮ, не в layout-схеме.`);
  lines.push(' * Запуск: validateModel(model, formValidation).');
  lines.push(' */');
  // Импортируем только использованное: проекты собираются с `noUnusedLocals`, и лишний
  // импорт «на всякий случай» не даст форме скомпилироваться.
  lines.push(`import { ${ops.join(', ')} } from '@reformer/core/validation';`);
  if (validators.length > 0) {
    lines.push(`import { ${validators.join(', ')} } from '@reformer/core/validators';`);
  }
  lines.push(`import type { ${intent.interfaceName} } from './model';`);
  lines.push('');
  lines.push(
    `export const formValidation = defineValidationSchema<${intent.interfaceName}>(({ model }) => {`
  );

  if (intent.validation.length === 0) {
    lines.push('  // Правил в intent не было — добавьте их здесь.');
  }
  for (const rule of intent.validation) {
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
    lines.push(block);
  }

  lines.push('});');
  return lines.join('\n') + '\n';
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

function fieldNode(f: FieldIntent): JsonNode {
  const props: Record<string, unknown> = { ...(f.componentProps ?? {}) };
  if (f.label) props.label = f.label;
  // POM e2e ожидает `data-testid="input-{testId}"`, поэтому testId проставляется всегда.
  props.testId = f.name;
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
  for (const f of a.itemFields) out[f.name] = emptyValue(f.type);
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
    case 'field': {
      const f = intent.fields.find((x) => x.name === node.ref);
      return f ? fieldNode(f) : null;
    }
    case 'array': {
      const a = intent.arrays.find((x) => x.name === node.ref);
      if (!a) return null;
      return {
        selector: a.name,
        array: `$model(${a.modelPath ?? a.name})`,
        component: `$component(${a.component ?? 'FormArray'})`,
        initialValue: emptyItem(a),
        item: {
          $template: {
            component: '$html(div)',
            children: a.itemFields.map(fieldNode),
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
    default:
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

export function buildLayoutJson(intent: FormIntent): string {
  const root = layoutToJson(intent.layoutRoot, intent) ?? { component: '$html(div)', children: [] };
  return JSON.stringify({ version: '1.0', root }, null, 2) + '\n';
}

/**
 * `renderer.schema.ts` — тот же JSON-DSL, обёрнутый в `defineJsonSchema<T>`.
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

/** Имя в схеме → импорт из ui-kit. Курируемая таблица: неизвестное имя даёт TODO + warning. */
const COMPONENT_IMPORTS: Record<string, string> = {
  Input: 'InputField',
  Textarea: 'TextareaField',
  Select: 'SelectField',
  Checkbox: 'CheckboxField',
  RadioGroup: 'RadioGroupField',
  DatePicker: 'DatePickerField',
  InputMask: 'InputMaskField',
  InputPassword: 'InputPasswordField',
  Switch: 'SwitchField',
  Combobox: 'ComboboxField',
  Box: 'Box',
  Section: 'Section',
  FormArray: 'FormArray',
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
      // `htmlTag` рендерится через `$html(...)` и регистрации не требует.
      if (!node.htmlTag) used.add(node.component);
      node.children.forEach(walk);
    } else if (node.kind === 'step') {
      used.add('Step');
      node.children.forEach(walk);
    }
  };
  walk(intent.layoutRoot);
  return used;
}

export function buildRegistryTs(intent: FormIntent): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  const used = collectUsedComponents(intent);

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
  lines.push(`import { ${['FormField', ...imports].join(', ')} } from '@reformer/ui-kit';`);
  lines.push(
    "import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';"
  );
  lines.push('');
  lines.push('export function createRegistry(): ComponentRegistry {');
  lines.push('  return defineRegistry((reg) => {');
  lines.push('    // Системная обёртка листа: label + ошибки.');
  lines.push('    reg.component(FIELD_WRAPPER, FormField);');
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
  lines.push(' * если оно должно перестать валидироваться, используйте enableWhen в behavior.ts.');
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
  /** Каноничное имя. */
  path: string;
  /** Зачем файл нужен — одной строкой. */
  role: string;
  /** Допустимые варианты имени/расширения (первым — то, что печатает генератор). */
  variants?: string[];
  /** Файл появляется не всегда. */
  optional?: boolean;
}

/**
 * Каноническая раскладка по таргетам — источник `06-form-directory-layout.md` §1.
 *
 * Таблица живёт рядом с генератором намеренно. Манифест — один из немногих каналов, по которым
 * имена файлов доезжают до консумента без чтения документации целиком; замер
 * (`docs/plans/mcp-layout-authority.md`) показал, что агент, работающий точечными запросами,
 * правило раскладки не получает вовсе, а манифест печатал 5 имён из 10 и ничем не сообщал, что
 * остальные консумент обязан создать сам. Поэтому список печатается ПОЛНЫЙ, с пометкой
 * происхождения у каждой строки.
 */
export const FORM_LAYOUT_CANON: Record<ReformerTargetStack, LayoutFileSpec[]> = {
  core: [
    { path: 'index.tsx', role: 'точка входа; ВСЕ шаги wizard-а инлайном' },
    { path: 'types.ts', role: 'локальные типы модуля' },
    { path: 'model.ts', role: 'интерфейс модели и начальные значения' },
    { path: 'form.schema.ts', role: 'схема разметки в TS', variants: ['form.schema.tsx'] },
    { path: 'form.behavior.ts', role: 'поведение модели: computeFrom / enableWhen / copyFrom' },
    { path: 'validation.ts', role: 'правила валидации' },
    { path: 'data-sources.ts', role: 'справочники и списки значений' },
    { path: 'api.ts', role: 'загрузка и submit' },
  ],
  'renderer-react': [
    { path: 'index.tsx', role: 'точка входа; ВСЕ шаги wizard-а инлайном' },
    { path: 'types.ts', role: 'локальные типы модуля' },
    { path: 'model.ts', role: 'интерфейс модели и начальные значения' },
    {
      path: 'renderer.schema.ts',
      role: 'схема разметки в TS (`.tsx`, если внутри есть JSX)',
      variants: ['renderer.schema.tsx'],
    },
    { path: 'form.behavior.ts', role: 'поведение модели: computeFrom / enableWhen / copyFrom' },
    { path: 'renderer.behavior.ts', role: 'поведение разметки: hideWhen по selector' },
    { path: 'validation.ts', role: 'правила валидации' },
    { path: 'data-sources.ts', role: 'справочники и списки значений' },
    { path: 'api.ts', role: 'загрузка и submit' },
  ],
  'renderer-json': [
    { path: 'index.tsx', role: 'точка входа; ВСЕ шаги wizard-а инлайном' },
    { path: 'types.ts', role: 'локальные типы модуля' },
    { path: 'model.ts', role: 'интерфейс модели и начальные значения' },
    {
      path: 'renderer.schema.ts',
      role: 'схема в JSON-DSL через `defineJsonSchema<T>` — с ним пути `$model(...)` проверяются на компиляции, с чистым `.json` нет',
      variants: ['renderer.schema.tsx', 'renderer.schema.json'],
    },
    { path: 'form.behavior.ts', role: 'поведение модели: computeFrom / enableWhen / copyFrom' },
    { path: 'renderer.behavior.ts', role: 'поведение разметки: hideWhen по selector' },
    { path: 'validation.ts', role: 'правила валидации' },
    { path: 'data-sources.ts', role: 'справочники и списки значений' },
    { path: 'api.ts', role: 'загрузка и submit' },
    { path: 'registry.ts', role: 'реестр: `$component(...)` → React-компонент' },
    {
      path: 'renderer.wizard.tsx',
      role: 'прикладной шим wizard-а (библиотека `RendererFormWizard` не экспортирует); допустимо держать его и внутри `registry.ts`',
      optional: true,
    },
  ],
};

/**
 * Тот же канон одной строкой — для каналов, где таблица `renderLayoutChecklist` не по бюджету.
 *
 * Такие каналы уже два: результат `plan_form` и сборка `get_context`. Строка собирается из
 * `FORM_LAYOUT_CANON`, а не пишется руками, иначе копии расходятся с каноном — ровно эта
 * поломка и разбирается в `docs/plans/mcp-layout-authority.md`.
 *
 * @param withOptional - Дописать опциональные файлы. По умолчанию нет: в `plan_form` строка
 *   отвечает на «какие файлы завести сейчас». В `get_context` — да: там она единственный
 *   источник имён, а `renderer.wizard.tsx` (шим wizard-а, библиотека его не экспортирует) —
 *   как раз то имя, которое агенты выдумывали сами (`json-wizard.tsx`, `wizard.tsx`).
 */
export function renderLayoutLine(target: ReformerTargetStack, withOptional = false): string {
  const canon = FORM_LAYOUT_CANON[target];
  const files = canon
    .filter((f) => !f.optional)
    .map((f) => `\`${f.path}\``)
    .join(' ');
  const optional = withOptional
    ? canon
        .filter((f) => f.optional)
        .map((f) => `\`${f.path}\``)
        .join(' ')
    : '';
  return (
    `Файлы модуля (${target}, плоский модуль, шаги инлайн): ${files}` +
    (optional ? ` (+ по необходимости ${optional})` : '') +
    '. Правило — `find_recipe directory-layout`, сверка имён — `validate_form kind="layout"`.'
  );
}

/** Файлы, которые манифест печатает, но в каталог модуля не кладут. */
const NOT_A_MODULE_FILE: Record<string, string> = {
  'layout.json':
    'в каталог модуля не кладут: это данные для ручной сборки схемы, перенесите их в схему и не сохраняйте сам файл',
};

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
    'Модуль формы плоский: без `lib/` / `schema/` / `components/steps/`, все шаги wizard-а ' +
      'инлайном в `index.tsx`. Точка-префикс только у слоевых концернов (`form.` — слой модели, ' +
      '`renderer.` — слой рендера), остальные файлы plain-named. Полное правило — ' +
      '`find_recipe directory-layout`.'
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
    const names =
      spec.variants && spec.variants.length > 0
        ? `\`${spec.path}\` (или ${spec.variants.map((v) => `\`${v}\``).join(', ')})`
        : `\`${spec.path}\``;
    rows.push(`| ${names} | ${spec.role} | ${origin} |`);
  }

  lines.push(
    `Сервер сгенерировал ${done} из ${required} обязательных файлов; остальные создайте сами — ` +
      'под этими именами, а не под своими.'
  );
  lines.push('');
  lines.push('| Файл | Роль | Откуда |');
  lines.push('| --- | --- | --- |');
  lines.push(...rows);

  const transient = generated.filter((p) => NOT_A_MODULE_FILE[p]);
  if (transient.length > 0) {
    lines.push('');
    for (const p of transient) lines.push(`\`${p}\` — ${NOT_A_MODULE_FILE[p]}.`);
  }

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
 * Файлы бандла для целевого стека.
 *
 * Раскладка — плоская (`minimalist`), с точкой-префиксом только у файлов, у которых есть
 * две слоевые версии (`form.` — модель, `renderer.` — разметка). Это конвенция репозитория,
 * зафиксированная в `docs/plans/mcp-staged-moonbeam.md`.
 *
 * Генерируется ПОДМНОЖЕСТВО набора: остальные файлы (`index.tsx`, `types.ts`, схема для core и
 * renderer-react, `data-sources.ts`, `api.ts`) пишет консумент. Полный набор с пометкой
 * происхождения печатает `renderLayoutChecklist` — без неё манифест читался как «файлов ровно
 * столько», и имена расходились с каноном.
 */
export function buildBundle(intent: FormIntent): {
  files: BundleFile[];
  warnings: string[];
  /** Layout как чистый JSON — для кросс-проверки, независимо от того, в каком файле он отдан. */
  layoutJson: string;
} {
  const warnings: string[] = [];
  const layoutJson = buildLayoutJson(intent);
  const files: BundleFile[] = [
    { path: 'model.ts', content: buildModelTs(intent) },
    { path: 'validation.ts', content: buildValidationTs(intent) },
    { path: 'form.behavior.ts', content: buildBehaviorTs(intent) },
  ];

  if (intent.target === 'renderer-json') {
    // Отдаём канонический `.ts` (`defineJsonSchema<T>`), а не чистый `.json`: только он держит
    // compile-time проверку путей `$model(...)` — ни ajv, ни обход реестра опечатку в пути не
    // ловят. Раньше здесь печатался `.json` с оговоркой в `## Warnings`; оговорку читают не все,
    // а блок кода копируют все, и неканоничное имя расходилось дальше по проекту.
    files.push({ path: 'renderer.schema.ts', content: buildRendererSchemaTs(intent) });
    const registry = buildRegistryTs(intent);
    files.push({ path: 'registry.ts', content: registry.content });
    warnings.push(...registry.warnings);
  } else {
    // core и renderer-react описывают разметку в TS; JSON здесь был бы чужим форматом,
    // поэтому отдаём тот же layout как данные для ручной сборки схемы.
    files.push({ path: 'layout.json', content: layoutJson });
    warnings.push(
      'Для target `' +
        intent.target +
        '` layout отдан как `layout.json` — перенесите его в form.schema.ts / renderer.schema.ts вручную: TS-схема держит ссылки на сигналы модели, которые в JSON невыразимы.'
    );
  }

  // Файл render-поведения эмитим, только если есть что в него положить: пустой файл
  // пришлось бы удалять руками, и он бы дезориентировал.
  if (intent.visibility.length > 0 && intent.target !== 'core') {
    files.push({ path: 'renderer.behavior.ts', content: buildRenderBehaviorTs(intent) });
  }

  return { files, warnings, layoutJson };
}
