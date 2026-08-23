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

  lines.push(`export interface ${intent.interfaceName} {`);
  for (const f of intent.fields) {
    if (f.label) lines.push(`  /** ${f.label} */`);
    lines.push(`  ${f.name}: ${fieldTsType(f)};`);
  }
  for (const a of intent.arrays) {
    lines.push(`  ${a.name}: ${a.itemInterfaceName}[];`);
  }
  lines.push('}');
  lines.push('');

  lines.push(`export const initialFormModel: ${intent.interfaceName} = {`);
  for (const f of intent.fields) lines.push(`  ${f.name}: ${initialLiteral(f)},`);
  for (const a of intent.arrays) lines.push(`  ${a.name}: ${JSON.stringify(a.initialValue)},`);
  lines.push('};');
  return lines.join('\n') + '\n';
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

function renderBehavior(b: BehaviorIntent): string {
  const target = `model.$.${b.target}`;
  const sources = b.sources.map((s) => `model.$.${s}`).join(', ');
  const opts = b.options ? `, ${JSON.stringify(b.options)}` : '';
  switch (b.kind) {
    case 'compute':
      return `  compute(${target}, () => ${b.expr ?? 'undefined'});`;
    case 'computeFrom':
      return `  computeFrom([${sources}], ${target}, (${b.sources.join(', ')}) => ${b.expr ?? 'undefined'});`;
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
// Сборка манифеста
// ---------------------------------------------------------------------------

/**
 * Файлы бандла для целевого стека.
 *
 * Раскладка — плоская (`minimalist`), с точкой-префиксом только у файлов, у которых есть
 * две слоевые версии (`form.` — модель, `renderer.` — разметка). Это конвенция репозитория,
 * зафиксированная в `docs/plans/mcp-staged-moonbeam.md`.
 */
export function buildBundle(intent: FormIntent): { files: BundleFile[]; warnings: string[] } {
  const warnings: string[] = [];
  const files: BundleFile[] = [
    { path: 'model.ts', content: buildModelTs(intent) },
    { path: 'validation.ts', content: buildValidationTs(intent) },
    { path: 'form.behavior.ts', content: buildBehaviorTs(intent) },
  ];

  if (intent.target === 'renderer-json') {
    files.push({ path: 'renderer.schema.json', content: buildLayoutJson(intent) });
    const registry = buildRegistryTs(intent);
    files.push({ path: 'registry.ts', content: registry.content });
    warnings.push(...registry.warnings);
  } else {
    // core и renderer-react описывают разметку в TS; JSON здесь был бы чужим форматом,
    // поэтому отдаём тот же layout как данные для ручной сборки схемы.
    files.push({ path: 'layout.json', content: buildLayoutJson(intent) });
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

  return { files, warnings };
}
