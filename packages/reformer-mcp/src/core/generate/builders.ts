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
  FormIntent,
  LayoutNode,
  NodeRuleIntent,
  ReformerTargetStack,
  ValidationRuleIntent,
} from './form-intent.js';
import { deriveComponentName } from './form-intent.js';
import { CORE_VALIDATORS } from './operator-catalog.js';
import {
  groupUiKitImports,
  UI_KIT_CONTAINER_EXPORTS,
  UI_KIT_FIELD_EXPORTS,
} from './ui-kit-components.js';
import {
  buildFormSchemaJson,
  buildFormSchemaJsonTs,
  buildFormSchemaTs,
  buildSchemaLayout,
  collectSteps,
  isWizardContainer,
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
function fieldTsType(field: FieldIntent, optional: ReadonlySet<FieldIntent> = NONE): string {
  const base = baseTsType(field);
  if (field.initialValue !== null && !optional.has(field)) return base;
  return base.includes('null') ? base : `${base} | null`;
}

const NONE: ReadonlySet<FieldIntent> = new Set();

function baseTsType(field: FieldIntent): string {
  return field.type === 'date' && !isDatePicker(field)
    ? 'string'
    : (TS_TYPE[field.type] ?? 'unknown');
}

/**
 * Текстовые поля без безусловного `required()` — `string | null` в модели, по конвенции ядра
 * (`08-form-types.md`: необязательное поле — `null`, «пользователь очистил»). Текстовые
 * компоненты кита пустой ввод так и пишут: `e.target.value || null`. С типом `string` агент писал
 * `model.promo.trim()`, `tsc` молчал, а стёртый промокод ронял шаг (ReFormer-b464). Обязательное
 * поле остаётся `string`: пустым его не пропускает валидация.
 */
function optionalText(intent: FormIntent): Set<FieldIntent> {
  const required = new Set(
    intent.validation
      .filter((v) => v.when === undefined && v.rules.some((rule) => /^required\b/.test(rule)))
      .map((v) => (v.each ? `${v.each}[].${rowPath(v.target, v.each)}` : v.target))
  );
  const out = new Set<FieldIntent>();
  const text = (f: FieldIntent) => baseTsType(f) === 'string';
  for (const f of intent.fields) {
    if (text(f) && !required.has(f.modelPath ?? f.name)) out.add(f);
  }
  for (const a of intent.arrays) {
    for (const f of a.itemFields) {
      if (text(f) && !required.has(`${a.name}[].${f.modelPath ?? f.name}`)) out.add(f);
    }
  }
  return out;
}

/**
 * Дата под календарём кита (`DatePicker`, значение — `Date`) или под полем ввода (`Input` с
 * `type: 'date'`, значение — строка `YYYY-MM-DD`). Тип модели обязан совпасть со значением
 * компонента: прежний `Date | null` для любой даты при начальном `''` из спеки давал `model.ts`,
 * который не компилируется (`Type 'string' is not assignable to type 'Date'`).
 */
function isDatePicker(field: FieldIntent): boolean {
  return /DatePicker/.test(field.component);
}

/** Литерал начального значения по типу поля. */
function initialLiteral(field: FieldIntent): string {
  if (field.type === 'date' && isDatePicker(field) && typeof field.initialValue === 'string') {
    // Пустая строка у календаря — «даты нет»; непустая — дата, которую надо построить.
    return field.initialValue === '' ? 'null' : `new Date(${JSON.stringify(field.initialValue)})`;
  }
  if (field.initialValue !== undefined) return JSON.stringify(field.initialValue);
  switch (field.type) {
    case 'number':
      return '0';
    case 'boolean':
      return 'false';
    case 'date':
      return isDatePicker(field) ? 'null' : "''";
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
  const optional = optionalText(intent);
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
  // `type`, а не `interface`: единый стиль сгенерированных типов. Ограничения
  // `Record<string, unknown>` на `FormGroup<T>` / `FormArray<T>` больше нет, interface тоже
  // допустим — но генератор печатает одно и то же, чтобы снимки и примеры не расходились.
  for (const arr of intent.arrays) {
    lines.push(`export type ${arr.itemInterfaceName} = {`);
    lines.push(...renderShape(fieldTree(arr.itemFields), 1, optional));
    lines.push('};');
    lines.push('');
  }

  const tree = modelTree(intent);

  lines.push(`export type ${intent.interfaceName} = {`);
  lines.push(...renderShape(tree, 1, optional));
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
    lines.push(...renderInitial(fieldTree(arr.itemFields), 1));
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

/**
 * Имя React-компонента формы — из её названия (`Регистрация` → `RegistratsiyaForm`,
 * `RegistrationForm` → `RegistrationForm`), а не из типа модели: от `RegistrationFormData`
 * получалось `RegistrationFormDataForm`. Название без букв — по типу, без удвоения `FormForm`.
 */
function formComponentName(intent: FormIntent): string {
  return (
    deriveComponentName(intent.formName) ??
    (/Form$/.test(intent.interfaceName) ? intent.interfaceName : `${intent.interfaceName}Form`)
  );
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
  const withSteps = collectSteps(intent.layoutRoot).length > 0;
  const json = intent.target === 'renderer-json';
  // Словарь подключается провайдером над разметкой; у `core` разметку пишет консумент, поэтому
  // там — подсказка в комментарии, а не импорты, которые образец не использовал бы.
  const withMessages = buildMessagesTs(intent).content !== null && intent.target !== 'core';
  const lines: string[] = [];

  lines.push("import { createForm } from '@reformer/core';");
  lines.push("import { useFormBundle } from '@reformer/core/react';");
  if (withMessages) lines.push("import { ValidationMessagesProvider } from '@reformer/cdk';");
  if (intent.target !== 'core')
    lines.push("import { FormRenderer } from '@reformer/renderer-react';");
  if (intent.target === 'renderer-react')
    lines.push("import { FormField } from '@reformer/ui-kit';");
  lines.push("import { formBehavior } from './form.behavior';");
  if (withMessages) lines.push("import { formMessages } from './form.messages';");
  lines.push("import { formSchema } from './form.schema';");
  if (withSteps) lines.push("import { formFlow } from './form.flow';");
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
  if (withSteps) lines.push('      flow: formFlow,');
  lines.push('    })');
  lines.push('  );');
  lines.push('');
  if (intent.target === 'core') {
    lines.push('  // Разметку рисуете сами: поля — `bundle.form.<путь>`, например');
    lines.push('  // <FormField control={bundle.form.email} />. Правила узлов схемы (`hideWhen`)');
    lines.push('  // исполняет только рендерер — видимость здесь остаётся условием в JSX.');
    if (buildMessagesTs(intent).content !== null) {
      lines.push('  // Тексты замечаний — `formMessages` из ./form.messages: оберните разметку в');
      lines.push('  // <ValidationMessagesProvider messages={formMessages}> (`@reformer/cdk`).');
    }
    lines.push('  return null;');
  } else {
    const renderer = json
      ? '<FormRenderer form={bundle} />'
      : '<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />';
    if (json) lines.push('  // Обёртка поля приходит из реестра (`FIELD_WRAPPER`).');
    if (withMessages) {
      lines.push('  return (');
      lines.push('    <ValidationMessagesProvider messages={formMessages}>');
      lines.push(`      ${renderer}`);
      lines.push('    </ValidationMessagesProvider>');
      lines.push('  );');
    } else {
      lines.push(`  return ${renderer};`);
    }
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
  return fieldTree(intent.fields, intent.arrays);
}

/**
 * Дерево полей — корня модели или ЭЛЕМЕНТА массива. У строки массива пути тоже бывают
 * составными (`coBorrowers[].personalData.lastName`): раньше тип элемента печатался плоско —
 * `personalData.lastName: string;`, не TypeScript, — а кросс-проверка при этом отвечала ✅
 * (калибровка, кредитная заявка).
 */
function fieldTree(
  fields: readonly FieldIntent[],
  arrays: readonly ArrayIntent[] = []
): Map<string, ModelNode> {
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
  for (const a of arrays) put(a.modelPath ?? a.name, { kind: 'array', array: a });
  // Путь берётся тот же, что уходит в `$model(...)` разметки, иначе привязка ведёт в никуда.
  for (const f of fields) put(f.modelPath ?? f.name, { kind: 'field', field: f });

  return root;
}

/** Тело интерфейса: группы разворачиваются во вложенные объекты. */
function renderShape(
  level: Map<string, ModelNode>,
  depth: number,
  optional: ReadonlySet<FieldIntent>
): string[] {
  const pad = '  '.repeat(depth);
  const out: string[] = [];
  for (const [key, node] of level) {
    if (node.kind === 'group') {
      out.push(`${pad}${objectKey(key)}: {`);
      out.push(...renderShape(node.children, depth + 1, optional));
      out.push(`${pad}};`);
      continue;
    }
    if (node.kind === 'array') {
      out.push(`${pad}${objectKey(key)}: ${node.array.itemInterfaceName}[];`);
      continue;
    }
    if (node.field.label) out.push(`${pad}/** ${node.field.label} */`);
    out.push(`${pad}${objectKey(key)}: ${fieldTsType(node.field, optional)};`);
  }
  return out;
}

/** Начальное значение — той же формы, что и интерфейс. */
function renderInitial(level: Map<string, ModelNode>, depth: number): string[] {
  const pad = '  '.repeat(depth);
  const out: string[] = [];
  for (const [key, node] of level) {
    if (node.kind === 'group') {
      out.push(`${pad}${objectKey(key)}: {`);
      out.push(...renderInitial(node.children, depth + 1));
      out.push(`${pad}},`);
      continue;
    }
    if (node.kind === 'array') {
      const rows = node.array.initialValue;
      const initial = rows.length > 0 ? `, ${JSON.stringify(rows)}` : '';
      out.push(`${pad}${objectKey(key)}: arrayOf(${blankName(node.array)}${initial}),`);
      continue;
    }
    out.push(`${pad}${objectKey(key)}: ${initialLiteral(node.field)},`);
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

/** Имя фабрики правила: `minLength(2)` → `minLength`. */
export function ruleName(rule: string): string | null {
  return rule.trim().match(/^([A-Za-z_$][\w$]*)/)?.[1] ?? null;
}

/**
 * Валидаторы ядра, которые вызывают правила. Свои правила (`operators`) импортируются из своего
 * модуля, а не из `@reformer/core/validators`: раньше любое имя уходило в импорт ядра, и правило,
 * которого в ядре нет, давало только ошибку компилятора.
 */
function collectValidators(
  rules: readonly ValidationRuleIntent[],
  operators: Readonly<Record<string, string>> = {}
): string[] {
  const used = new Set<string>();
  for (const rule of rules) {
    for (const r of rule.rules) {
      const name = ruleName(r);
      if (name && Object.hasOwn(CORE_VALIDATORS, name) && !Object.hasOwn(operators, name)) {
        used.add(name);
      }
    }
  }
  return [...used].sort();
}

/**
 * Код ссылается на имя `name` — само по себе, а не на свойство `model.name`: вызов своего оператора
 * или схема, переданная аргументом (`validateModel(model, passwordRules)`).
 */
export function mentionsName(code: string, name: string): boolean {
  return new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(code);
}

/**
 * Импорты своих операторов, на которые ссылается код файла: по строке `import { … } from '<модуль>'`
 * на модуль. Импортируется только нужное — проекты собираются с `noUnusedLocals`.
 */
export function operatorImportLines(
  operators: Readonly<Record<string, string>> | undefined,
  code: readonly string[]
): string[] {
  const byModule = new Map<string, string[]>();
  for (const [name, module] of Object.entries(operators ?? {})) {
    if (!code.some((part) => mentionsName(part, name))) continue;
    byModule.set(module, [...(byModule.get(module) ?? []), name]);
  }
  return [...byModule].map(
    ([module, names]) => `import { ${names.sort().join(', ')} } from '${module}';`
  );
}

/** Код правил, в котором могут встретиться вызовы своих операторов. */
function validationCode(rules: readonly ValidationRuleIntent[]): string[] {
  return rules.flatMap((rule) => [
    ...rule.rules,
    ...[rule.call, rule.cross, rule.async, rule.when].filter((part): part is string => !!part),
    ...Object.values(rule.params ?? {}),
  ]);
}

/** Параметры `buildValidationSchemaTs`: всё, что модуль берёт не из правил. */
export interface ValidationSchemaTsOptions {
  /** Тип модели — параметр `defineValidation<…>`. */
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
  /**
   * Свои операторы, которые могут вызывать правила: имя → спецификатор модуля, как его импортирует
   * этот файл (`FormIntent.operators` у файла в корне модуля).
   */
  operators?: Readonly<Record<string, string>>;
}

/**
 * Валидаторы и операторы, которые реально нужны набору правил.
 *
 * Импортируется только использованное: проекты собираются с `noUnusedLocals`, и лишний импорт
 * «на всякий случай» не даст форме скомпилироваться. Поэтому набор считается по ТОМУ
 * подмножеству правил, которое печатается в модуль, — у файла шага он свой.
 */
function validationImports(
  rules: readonly ValidationRuleIntent[],
  operators?: Readonly<Record<string, string>>
): {
  ops: string[];
  validators: string[];
  /** Импорты своих операторов — готовыми строками. */
  custom: string[];
} {
  // `validate` нужен правилам с валидаторами; набор из одних кросс-полевых и асинхронных проверок
  // его не зовёт. Пустой набор оставляет его: заготовка предлагает дописать правила им.
  const usesValidate = rules.length === 0 || rules.some((r) => r.rules.length > 0);
  const ops = usesValidate ? ['validate', 'defineValidation'] : ['defineValidation'];
  if (rules.some((r) => r.async)) ops.push('validateAsync');
  if (rules.some((r) => r.when)) ops.push('validateWhen');
  if (rules.some((r) => r.each)) ops.push('applyEach');
  return {
    ops,
    validators: collectValidators(rules, operators),
    custom: operatorImportLines(operators, validationCode(rules)),
  };
}

/** Код замечания кросс-полевой проверки, если правило его не назвало. */
const DEFAULT_CROSS_CODE = 'cross';

/**
 * `cross(ref, (values) => …)`: выражение правила должно быть истинным, иначе — замечание с кодом.
 * Скобки вокруг выражения — чтобы `a || b` не связался с тернарным оператором иначе, чем написано.
 * Код — в одинарных кавычках, как строки во всём напечатанном модуле (`prettier --check`).
 */
// ---------------------------------------------------------------------------
// data-sources.ts — справочники
// ---------------------------------------------------------------------------

/**
 * Имена справочников формы: объявленные в intent и названные полями (`optionsSource`,
 * `suggestionsSource`).
 */
function dataSourceNames(intent: FormIntent): string[] {
  const names = new Set(intent.dataSources.map((d) => d.name));
  const visit = (f: FieldIntent) => {
    if (f.optionsSource) names.add(f.optionsSource);
    if (f.suggestionsSource) names.add(f.suggestionsSource);
  };
  intent.fields.forEach(visit);
  intent.arrays.forEach((a) => a.itemFields.forEach(visit));
  return [...names];
}

/**
 * `data-sources.ts` — значения справочников.
 *
 * TS-схема и раньше импортировала их отсюда (`componentProps.options: LOAN_TYPES`), а реестр
 * renderer-json — обещал (`// TODO: reg.dataSource(…)`), но самого файла генератор не печатал:
 * бандл с полем выбора не собирался, а под renderer-json поле рисовалось без вариантов
 * (калибровка, кредитная заявка). Теперь значения приходят в intent (`dataSources[].values`).
 */
export function buildDataSourcesTs(intent: FormIntent): {
  content: string | null;
  warnings: string[];
} {
  const names = dataSourceNames(intent);
  if (names.length === 0) return { content: null, warnings: [] };
  const warnings: string[] = [];
  const lines = [
    '/**',
    ` * Справочники формы «${intent.formName}» — варианты полей выбора. TS-схема кладёт их в`,
    ' * `componentProps.options`, реестр renderer-json регистрирует под теми же именами',
    ' * (`$dataSource(NAME)` в схеме).',
    ' */',
  ];
  for (const name of names) {
    const ds = intent.dataSources.find((d) => d.name === name);
    lines.push('');
    if (ds?.note) lines.push(`/** ${ds.note} */`);
    if (ds?.values && ds.values.length > 0) {
      // Примитив — вариант с подписью из самого значения: поля выбора кита ждут `{ value, label }`.
      const options = ds.values.map((v) =>
        v !== null && typeof v === 'object' ? v : { value: v, label: String(v) }
      );
      lines.push(`export const ${name} = ${JSON.stringify(options, null, 2)};`);
    } else {
      lines.push(`// TODO: значения справочника ${name}.`);
      lines.push(`export const ${name}: Array<{ value: string; label: string }> = [];`);
      warnings.push(
        `Справочник \`${name}\` без значений — в data-sources.ts пустой массив, поле выбора ` +
          'останется без вариантов: передайте `values` в `dataSources` intent или впишите их в файл.'
      );
    }
  }
  return { content: lines.join('\n') + '\n', warnings };
}

// ---------------------------------------------------------------------------
// form.messages.ts — тексты замечаний
// ---------------------------------------------------------------------------

/**
 * Код замечания, к которому относится `message` правила: явный `code`, у `cross` — код по
 * умолчанию, иначе код из вызова валидатора (`required({ code: 'phone.required' })`), если он там
 * один. Два кода в одном правиле — непонятно, к какой проверке текст, и тогда `null`.
 */
function messageCode(rule: ValidationRuleIntent): string | null {
  if (rule.code) return rule.code;
  if (rule.cross) return DEFAULT_CROSS_CODE;
  const codes = new Set(
    rule.rules.flatMap((r) => [...r.matchAll(/\bcode:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))
  );
  return codes.size === 1 ? [...codes][0] : null;
}

/** Строковый литерал TS в одинарных кавычках. */
function tsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

/**
 * Предупреждение `buildMessagesTs` о потерянном тексте замечания. `generate_form` только печатает
 * его, а для `form_build` это ошибка: агенты заканчивали работу на ✓, теряя тексты.
 */
export function isLostMessageWarning(warning: string): boolean {
  return /^Текст «|^Код `[^`]*` получил два текста/.test(warning);
}

/**
 * `form.messages.ts` — словарь «код → текст» из `message` правил intent.
 *
 * Правило несёт код, строку по коду даёт словарь (`defineIssueMessages`) через
 * `ValidationMessagesProvider`. Без словаря форма показывает пользователю сам код
 * (`passwords-mismatch`), а `message` из intent пропадал молча — его просто некуда было печатать.
 *
 * @returns `content: null` — текстов нет; предупреждения — тексты, которые не к чему привязать.
 */
export function buildMessagesTs(intent: FormIntent): {
  content: string | null;
  warnings: string[];
} {
  const entries = new Map<string, string>();
  const warnings: string[] = [];
  for (const rule of intent.validation) {
    if (!rule.message) continue;
    const code = messageCode(rule);
    if (!code) {
      warnings.push(
        `Текст «${rule.message}» у правила на \`${rule.target}\` не попал в form.messages.ts: ` +
          'не понять, к какому коду он относится — задайте правилу `code` (одно правило — один код).'
      );
      continue;
    }
    const previous = entries.get(code);
    if (previous !== undefined && previous !== rule.message) {
      warnings.push(
        `Код \`${code}\` получил два текста — в словаре оставлен первый: «${previous}».`
      );
      continue;
    }
    entries.set(code, rule.message);
  }
  if (entries.size === 0) return { content: null, warnings };

  const lines = [
    '/**',
    ` * Тексты замечаний формы «${intent.formName}»: правило несёт код, строку по коду даёт словарь.`,
    ' * Подключение: `<ValidationMessagesProvider messages={formMessages}>` (`@reformer/cdk`) над формой.',
    ' */',
    "import { defineIssueMessages } from '@reformer/core/i18n';",
    '',
    'export const formMessages = defineIssueMessages({',
    ...[...entries].map(([code, text]) => `  ${tsString(code)}: ${tsString(text)},`),
    '});',
  ];
  return { content: lines.join('\n') + '\n', warnings };
}

// ---------------------------------------------------------------------------
// operators.ts — заготовка своих операторов
// ---------------------------------------------------------------------------

/** Метка заготовки: пока она в файле своих операторов, `form_build` напоминает дописать тела. */
export const OPERATOR_STUB_MARK = 'TODO(form_build)';

/** Модули каталога формы, которые пишет сборка: свои операторы в них жить не могут. */
const DERIVED_MODULES = new Set(['model', 'data-sources', 'registry', 'index']);

/**
 * Файл каталога формы, в котором живёт модуль своих операторов: `./operators` → `operators.ts`.
 * Модуль вне каталога (`@/shared/validators`, `../common/rules`) — `null`: его пишет проект, и
 * заготовки для него нет. Модуль сборки (`./model`) — тоже `null`, о нём говорит кросс-проверка.
 */
export function operatorModuleFile(module: string): string | null {
  const name = module.match(/^\.\/([A-Za-z0-9_-]+)(?:\.(?:js|ts))?$/)?.[1];
  return name && !DERIVED_MODULES.has(name) ? `${name}.ts` : null;
}

/** Модуль, который пишет сборка: свои операторы оттуда не импортировать. */
export function isDerivedModule(module: string): boolean {
  const name = module.match(/^\.\/([A-Za-z0-9_.-]+?)(?:\.(?:js|ts|tsx))?$/)?.[1];
  return name !== undefined && (DERIVED_MODULES.has(name) || name.startsWith('form.'));
}

/** Как intent пользуется своим оператором — от этого зависит его заготовка. */
type OperatorRole = 'rule' | 'validation' | 'behavior' | 'schema' | 'function';

/** Тип значения поля, к которому относится правило; `null` — поле не найдено. */
function ruleFieldType(
  intent: FormIntent,
  rule: ValidationRuleIntent,
  optional: ReadonlySet<FieldIntent>
): string | null {
  const matches = (path: string) => (f: FieldIntent) =>
    (f.modelPath ?? f.name) === path || f.name === path;
  if (rule.each !== undefined) {
    const array = intent.arrays.find(
      (a) => a.name === rule.each || (a.modelPath ?? a.name) === rule.each
    );
    const field = array?.itemFields.find(matches(rowPath(rule.target, rule.each)));
    return field ? fieldTsType(field, optional) : null;
  }
  const field = intent.fields.find(matches(rule.target));
  return field ? fieldTsType(field, optional) : null;
}

/** Роль каждого своего оператора и, у правила, типы значений полей, к которым оно применено. */
function operatorRoles(intent: FormIntent): Map<string, { role: OperatorRole; types: string[] }> {
  const roles = new Map<string, { role: OperatorRole; types: string[] }>();
  const optional = optionalText(intent);
  const behavior = behaviorCode(intent, true);
  for (const name of Object.keys(intent.operators ?? {})) {
    const ruled = intent.validation.filter((v) => v.rules.some((r) => ruleName(r) === name));
    if (ruled.length > 0) {
      const types = ruled.map((rule) => ruleFieldType(intent, rule, optional) ?? 'unknown');
      roles.set(name, { role: 'rule', types });
    } else if (intent.validation.some((v) => v.call && ruleName(v.call) === name)) {
      roles.set(name, { role: 'validation', types: [] });
    } else if (intent.behavior.some((b) => b.kind === 'call' && ruleName(b.expr ?? '') === name)) {
      roles.set(name, { role: 'behavior', types: [] });
    } else if (
      behavior.some((code) => new RegExp(`validateModel\\(\\s*\\w+\\s*,\\s*${name}\\b`).test(code))
    ) {
      roles.set(name, { role: 'schema', types: [] });
    } else {
      roles.set(name, { role: 'function', types: [] });
    }
  }
  return roles;
}

/** Типы значений одним объединением: `string | null` и `string` → `string | null`. */
function unionOf(types: readonly string[]): string {
  if (types.includes('unknown')) return 'unknown';
  const parts = new Set(types.flatMap((type) => type.split(' | ')));
  return [...parts].join(' | ') || 'unknown';
}

function operatorStub(
  name: string,
  role: OperatorRole,
  types: readonly string[],
  intent: FormIntent
): string[] {
  const mark = OPERATOR_STUB_MARK;
  switch (role) {
    case 'rule':
      return [
        `/** ${mark}: правило — верни замечание \`{ code }\`, когда значение неверно, иначе \`null\`. */`,
        `export function ${name}(..._args: unknown[]): Rule<${unionOf(types)}> {`,
        '  return (_value) => null;',
        '}',
      ];
    case 'validation':
      return [
        '/**',
        ` * ${mark}: оператор валидации, его вызывает схема формы. Пиши его на \`validate\`, \`cross\`,`,
        " * `validateWhen` из '@reformer/core/validation'.",
        ' */',
        `export function ${name}(..._args: unknown[]): void {`,
        `  // ${mark}: правила оператора.`,
        '}',
      ];
    case 'behavior':
      return [
        '/**',
        ` * ${mark}: оператор поведения, его вызывает поведение формы. Пиши его на операторах`,
        " * '@reformer/core/behaviors' (`onChange`, `transformValue`, …) или на `effect` + `onDispose`.",
        ' */',
        `export function ${name}(..._args: unknown[]): void {`,
        `  // ${mark}: связи оператора.`,
        '}',
      ];
    case 'schema':
      return [
        `/** ${mark}: своя схема валидации — её перезапускает \`validateModel\` из поведения. */`,
        `export const ${name} = defineValidation<${intent.interfaceName}>(() => {`,
        `  // ${mark}: правила схемы.`,
        '});',
      ];
    default:
      return [
        `/** ${mark}: функция, которую читают выражения intent, — задай ей параметры и результат. */`,
        `export function ${name}(..._args: unknown[]): void {`,
        `  // ${mark}: тело функции.`,
        '}',
      ];
  }
}

/**
 * Заготовки модулей своих операторов, лежащих в каталоге формы (`./operators` → `operators.ts`).
 *
 * Тела пишет автор формы. Пока заготовку не правили, `form_build` пересобирает её под intent (роль
 * оператора меняется, когда форму пишут частями); правка отсоединяет файл, как любой файл сборки.
 * Сигнатуры заготовок принимают любые аргументы — вызов из intent компилируется сразу, а точные
 * параметры автор задаёт, когда пишет тело. Тело заготовки ничего не делает: правило всегда
 * пропускает значение, — поэтому `form_build` напоминает о каждой оставшейся метке.
 */
export function buildOperatorStubs(intent: FormIntent): BundleFile[] {
  const roles = operatorRoles(intent);
  const byFile = new Map<string, string[]>();
  for (const [name, module] of Object.entries(intent.operators ?? {})) {
    const file = operatorModuleFile(module);
    if (file) byFile.set(file, [...(byFile.get(file) ?? []), name]);
  }
  return [...byFile].map(([path, names]) => {
    const used = names.map((name) => ({
      name,
      ...(roles.get(name) ?? { role: 'function' as const, types: [] }),
    }));
    const rules = used.some((op) => op.role === 'rule');
    const schemas = used.some((op) => op.role === 'schema');
    const core = [...(schemas ? ['defineValidation'] : []), ...(rules ? ['type Rule'] : [])];
    const lines = [
      '/**',
      ` * Свои операторы формы «${intent.formName}» — их вызывает \`form.intent.json\` (раздел`,
      ' * `operators`). Пока файл не правлен, сборка обновляет заготовку под intent; первая правка',
      ' * делает его твоим. Допиши тела: пока в файле остаются метки заготовки, form_build напоминает.',
      ' */',
      ...(core.length > 0
        ? [
            core.length === 1 && rules
              ? "import type { Rule } from '@reformer/core/validation';"
              : `import { ${core.join(', ')} } from '@reformer/core/validation';`,
          ]
        : []),
      ...(schemas ? [`import type { ${intent.interfaceName} } from './model';`] : []),
      ...used.flatMap((op) => ['', ...operatorStub(op.name, op.role, op.types, intent)]),
    ];
    return { path, content: lines.join('\n') + '\n' };
  });
}

function crossLine(ref: string, rule: ValidationRuleIntent): string {
  const code = (rule.code ?? DEFAULT_CROSS_CODE).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  // Предупреждение и параметры замечания — те же поля `ValidationIssue`, что у валидаторов ядра
  // (калибровка кредитной заявки, A13 и A15: без них предупреждения становились ошибками, а
  // тексты — без чисел).
  const params = Object.entries(rule.params ?? {}).map(
    ([name, expr]) => `${/^[A-Za-z_$][\w$]*$/.test(name) ? name : tsString(name)}: ${expr}`
  );
  const issue = [
    `code: '${code}'`,
    ...(rule.severity === 'warning' ? ["severity: 'warning'"] : []),
    ...(params.length > 0 ? [`params: { ${params.join(', ')} }`] : []),
  ];
  return `cross(${ref}, (values) => ((${rule.cross}) ? null : { ${issue.join(', ')} }));`;
}

/**
 * Параметры схемы валидации: `cross` — только когда им пользуется правило верхнего уровня. Лишний
 * параметр — неиспользованная переменная, а проекты собираются с `noUnusedLocals`.
 */
function schemaParams(rules: readonly ValidationRuleIntent[]): string {
  return rules.some((rule) => rule.cross && !rule.each) ? '{ model, cross }' : '{ model }';
}

/** Строки, вложенные в блок `head … });` с отступом в два пробела. */
function wrapBlock(head: string, lines: readonly string[]): string[] {
  return [head, ...lines.map((line) => `  ${line}`), '});'];
}

/**
 * Одно правило intent → строки тела схемы (с отступом тела).
 *
 * Обёртки вкладываются снаружи внутрь: условие → строки массива → проверки. Условие `when`
 * записано над КОРНЕВОЙ моделью, поэтому у правила строки оно оборачивает саму привязку
 * `applyEach`, а не проверки внутри строки, — так же, как у схемы строки ({@link applyRowSchema}).
 * Раньше ветка строки собирала блок заново из проверок, и условие терялось: правило становилось
 * безусловным, а импорт `validateWhen` оставался неиспользованным (`noUnusedLocals`).
 */
function validationRuleBlock(rule: ValidationRuleIntent): string {
  const each = rule.each;
  // Правило строки адресует поле ЭЛЕМЕНТА: цель пишут и от строки (`name`), и полным путём
  // (`items.name`) — второе даёт `item.$.items.name`, которого у строки нет.
  const target =
    each !== undefined && rule.target.startsWith(`${each}.`)
      ? rule.target.slice(each.length + 1)
      : rule.target;
  const ref = each !== undefined ? `item.$.${target}` : `model.$.${target}`;

  let lines: string[] = [];
  if (rule.rules.length > 0) {
    lines.push(`validate(${ref}, [${rule.rules.map(callValidator).join(', ')}]);`);
  }
  if (rule.async) {
    lines.push(`validateAsync(${ref}, [${rule.async}]);`);
  }
  if (rule.cross) lines.push(crossLine(ref, rule));
  // Свой оператор валидации — вызов как есть: что и как он проверяет, знает только он.
  if (rule.call) lines.push(`${rule.call.replace(/;\s*$/, '')};`);
  if (each !== undefined) {
    // Правила строки — схема над элементом, записанная на месте: `applyEach` отдаёт ей под-модель
    // и свой `cross` — над снимком строки.
    const params = rule.cross ? '{ model: item, cross }' : '{ model: item }';
    lines = wrapBlock(`applyEach(model.$.${each}, (${params}) => {`, lines);
  }
  if (rule.when) {
    lines = wrapBlock(`validateWhen(() => ${rule.when}, () => {`, lines);
  }
  return lines.map((line) => `  ${line}`).join('\n');
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
 * Печатает `import …` + `export const <exportName> = defineValidation<…>(…)` и ничего
 * сверх: сборка корня (`apply(...)`, `makeStepCheck`) — дело потребителя.
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
  const { ops, validators, custom } = validationImports(rules, opts.operators);

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
  lines.push(...custom);
  lines.push(`import type { ${opts.interfaceName} } from '${opts.typeImport}';`);
  lines.push('');
  lines.push(
    `export const ${opts.exportName} = defineValidation<${opts.interfaceName}>((${schemaParams(rules)}) => {`
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
    operators: intent.operators,
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
 * - у формы с шагами правила разложены по шагам и экспортируются: поток шагов `formFlow`
 *   (`form.flow.ts`, {@link buildFormFlowTs}) берёт их по шагу; правила вне шагов — в `extras`
 *   объекта `formValidation` (проверяются целиком, при отправке).
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

  // `applyEach` в списке уже есть, когда у формы есть правила строк: его добавляет `validationImports`.
  const {
    ops: operators,
    validators,
    custom,
  } = validationImports(formRules.concat(rowRules), intent.operators);

  const itemTypes = [...new Set(rowSchemas.map((row) => row.itemType))].filter(
    (type) => type !== 'Record<string, unknown>'
  );

  const schema = (
    name: string,
    type: string,
    body: string[],
    rules: readonly ValidationRuleIntent[],
    exported = false
  ): string[] => [
    `${exported ? 'export ' : ''}const ${name} = defineValidation<${type}>((${schemaParams(rules)}) => {`,
    ...(body.length > 0 ? body : ['  // Правил в intent не было — добавьте их здесь.']),
    '});',
    '',
  ];
  const applyRows = (rows: RowSchema[]): string[] => rows.map(applyRowSchema);

  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Валидация формы «${intent.formName}» — правила над МОДЕЛЬЮ, не в схеме разметки.`);
  if (withSteps) {
    lines.push(
      ' * Правила шагов уходят в поток `formFlow` (form.flow.ts), правила вне шагов — сюда.'
    );
    lines.push(' * Подключение: createForm({ …, validation: formValidation, flow: formFlow }).');
  } else {
    lines.push(' * Подключение: createForm({ …, validation: formValidation }).');
  }
  lines.push(' */');
  if (withSteps) lines.push("import type { FormValidation } from '@reformer/core';");
  lines.push(`import { ${operators.sort().join(', ')} } from '@reformer/core/validation';`);
  if (validators.length > 0) {
    lines.push(`import { ${validators.join(', ')} } from '@reformer/core/validators';`);
  }
  lines.push(...custom);
  lines.push(`import type { ${[intent.interfaceName, ...itemTypes].join(', ')} } from './model';`);
  lines.push('');

  for (const row of rowSchemas) {
    lines.push(`/** Правила строки массива \`${row.path}\`: пути — от элемента. */`);
    // Правила строки — уже от элемента: `cross` строки нужен, если им пользуется хоть одно.
    const rowRules = row.rules.map((rule) => ({ ...rule, each: undefined }));
    lines.push(...schema(row.name, row.itemType, rowRuleLines(row.rules, row.each), rowRules));
  }

  if (!withSteps) {
    lines.push(
      ...schema(
        'formValidation',
        intent.interfaceName,
        [...ruleLines(formRules), ...applyRows(rowSchemas)],
        formRules,
        true
      )
    );
    return lines.join('\n').trimEnd() + '\n';
  }

  for (const step of stepSchemas) {
    if (step.rules.length === 0 && step.rows.length === 0) continue;
    lines.push(`/** Правила шага \`${step.key}\` — их проверяет \`next()\` потока. */`);
    lines.push(
      ...schema(
        step.name,
        intent.interfaceName,
        [...ruleLines(step.rules), ...applyRows(step.rows)],
        step.rules,
        true
      )
    );
  }
  const hasExtras = restRules.length > 0 || restRows.length > 0;
  if (hasExtras) {
    const extrasName = identifierFrom('crossStep', 'Rules', taken);
    lines.push('/** Правила вне шагов: проверяются целиком, при отправке. */');
    lines.push(
      ...schema(
        extrasName,
        intent.interfaceName,
        [...ruleLines(restRules), ...applyRows(restRows)],
        restRules
      )
    );
    lines.push(`export const formValidation: FormValidation<${intent.interfaceName}> = {`);
    lines.push(`  extras: ${extrasName},`);
    lines.push('};');
  } else {
    lines.push('/** Правил вне шагов нет: все правила — у шагов потока. */');
    lines.push(`export const formValidation: FormValidation<${intent.interfaceName}> = {};`);
  }
  return lines.join('\n') + '\n';
}

/** Шаги визарда по разметке и имена их схем правил — общие для валидации и потока. */
function stepPlan(intent: FormIntent): Array<{ key: string; name: string | null }> {
  const taken = new Set<string>(['formValidation']);
  const rowRules = intent.validation.filter((rule) => rule.each);
  const formRules = intent.validation.filter((rule) => !rule.each);
  // Имена схем строк занимают идентификаторы раньше шагов — порядок как в buildFormValidationTs.
  const rowNames = new Map<string, string>();
  for (const rule of rowRules) {
    const each = rule.each as string;
    const id = `${each}::${rule.when ?? ''}`;
    if (!rowNames.has(id)) {
      rowNames.set(id, identifierFrom(each.split('.').pop() ?? each, 'RowRules', taken));
    }
  }
  const steps = collectSteps(intent.layoutRoot);
  const owner = stepOfPath(intent, steps);
  return steps.map((step, index) => {
    const key = stepKeyOf(step, index);
    const name = identifierFrom(key, 'Rules', taken);
    const hasRules =
      formRules.some((rule) => owner.get(rule.target) === index) ||
      rowRules.some((rule) => {
        const each = rule.each as string;
        const array = intent.arrays.find(
          (a) => a.name === each || (a.modelPath ?? a.name) === each
        );
        const path = array?.modelPath ?? array?.name ?? each;
        return (owner.get(path) ?? owner.get(each)) === index;
      });
    return { key, name: hasRules ? name : null };
  });
}

/**
 * `form.flow.ts` формы с шагами: поток шагов `formFlow` (`FormFlowConfig`). Идентификатор шага —
 * `selector` узла шага в схеме, правила — схема шага из `form.validation.ts`; шаг без правил
 * объявлен без `rules`. У формы без шагов файла нет — `null`.
 */
export function buildFormFlowTs(intent: FormIntent): string | null {
  const steps = stepPlan(intent);
  if (steps.length === 0) return null;
  const ruleNames = steps.flatMap((step) => (step.name ? [step.name] : []));
  const lines: string[] = [];
  lines.push('/**');
  lines.push(
    ` * Поток шагов формы «${intent.formName}»: идентификатор шага — \`selector\` узла шага в схеме,`
  );
  lines.push(' * `next()` потока проверяет правила текущего шага.');
  lines.push(' * Подключение: createForm({ …, flow: formFlow }).');
  lines.push(' */');
  lines.push("import type { FormFlowConfig } from '@reformer/core';");
  if (ruleNames.length > 0) {
    lines.push(`import { ${ruleNames.join(', ')} } from './form.validation';`);
  }
  lines.push(`import type { ${intent.interfaceName} } from './model';`);
  lines.push('');
  lines.push(`export const formFlow: FormFlowConfig<${intent.interfaceName}> = {`);
  lines.push('  steps: [');
  for (const step of steps) {
    const id = `'${step.key.replace(/['\\]/g, (char) => `\\${char}`)}'`;
    lines.push(step.name ? `    { id: ${id}, rules: ${step.name} },` : `    { id: ${id} },`);
  }
  lines.push('  ],');
  lines.push('};');
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

/**
 * Опции `resetWhen`. Без `resetValue` ядро сбрасывает поле в `null`, и для поля, в тип которого
 * `null` не входит, `resetValue` обязателен по типу (ReFormer-2183): без него сгенерированный
 * файл не компилировался бы. Такому полю генератор подставляет его начальное значение.
 */
function resetWhenOptions(b: BehaviorIntent, intent: FormIntent): string {
  const json = b.options ? JSON.stringify(b.options) : undefined;
  const field = intent.fields.find(
    (f) => (f.modelPath ?? f.name) === b.target || f.name === b.target
  );
  const given = b.options !== undefined && 'resetValue' in b.options;
  if (field === undefined || given || fieldTsType(field, optionalText(intent)).includes('null')) {
    return json ? `, ${json}` : '';
  }
  const resetValue = `resetValue: ${initialLiteral(field)}`;
  return json && json !== '{}' ? `, ${json.slice(0, -1)}, ${resetValue} }` : `, { ${resetValue} }`;
}

/**
 * Условие вычисления: `, { when: () => … }`. Выражение читает модель, как и формула; у
 * `computeFrom` условие без параметров — ядро принимает и такую функцию.
 */
function computeWhen(b: BehaviorIntent): string {
  return b.when ? `, { when: () => ${b.when} }` : '';
}

/** Путь поля строки — от строки: `items.qty` при `each: 'items'` → `qty`. */
function rowPath(path: string, each: string): string {
  return path.startsWith(`${each}.`) ? path.slice(each.length + 1) : path;
}

/**
 * Поведение каждой строки печатается внутри `applyEach`: ручки — от строки (`item.$.qty`), а
 * колбэк строки объявляет `item`. `exclusiveFlag` и `aggregateInto` — операторы над массивом
 * целиком и в `applyEach` не заворачиваются.
 */
function isRowBehavior(b: BehaviorIntent): b is BehaviorIntent & { each: string } {
  return b.each !== undefined && b.kind !== 'exclusiveFlag' && b.kind !== 'aggregateInto';
}

/**
 * Строки тела поведения: связи формы — по одной, связи строк одного массива — одним `applyEach`
 * на месте первой из них.
 */
function renderBehaviors(intent: FormIntent): string[] {
  // Элемент — строка связи формы либо группа связей строк одного массива (на месте первой).
  const parts: (string | { each: string; items: BehaviorIntent[] })[] = [];
  const groups = new Map<string, { each: string; items: BehaviorIntent[] }>();
  for (const b of intent.behavior) {
    if (!isRowBehavior(b)) {
      parts.push(renderBehavior(b, intent));
      continue;
    }
    const group = groups.get(b.each);
    if (group !== undefined) {
      group.items.push(b);
      continue;
    }
    const created = { each: b.each, items: [b] };
    groups.set(b.each, created);
    parts.push(created);
  }
  return parts.flatMap((part) =>
    typeof part === 'string'
      ? [part]
      : [
          // `applyEach` ждёт поведение (`FormBehavior`), а не голую стрелку; тип строки
          // `defineFormBehavior` выводит из массива.
          `  applyEach(model.$.${part.each}, defineFormBehavior(({ model: item }) => {`,
          // Связь бывает в несколько строк (пояснение над `computeFrom`): отступ — каждой.
          ...part.items.flatMap((b) =>
            renderBehavior(b, intent, 'item')
              .split('\n')
              .map((line) => `  ${line}`)
          ),
          '  }));',
        ]
  );
}

/**
 * Операторы поведения, которые печатает набор: виды связей и `applyEach` для связей строк. Вызов
 * своего оператора (`call`) импортирует его модуль, а не ядро.
 */
function behaviorOps(intent: FormIntent): string[] {
  const ops = new Set<string>(intent.behavior.filter((b) => b.kind !== 'call').map((b) => b.kind));
  if (intent.behavior.some(isRowBehavior)) ops.add('applyEach');
  return [...ops];
}

/** Код поведения, в котором могут встретиться свои операторы и функции ядра. */
function behaviorCode(intent: FormIntent, withNodes: boolean): string[] {
  return [
    ...intent.behavior.flatMap((b) => [b.expr ?? '', b.when ?? '']),
    ...(withNodes ? (intent.nodes ?? []).map((rule) => rule.expr) : []),
    ...(withNodes ? intent.visibility.map((v) => v.condition) : []),
  ];
}

/**
 * Импорты поведения сверх операторов ядра: свои операторы и `validateModel` — перезапуск своей
 * схемы (`revalidateWhen`). Без него выражение `void validateModel(model, rules)` не собиралось бы.
 */
function behaviorExtraImports(intent: FormIntent, withNodes: boolean): string[] {
  const code = behaviorCode(intent, withNodes);
  return [
    ...(code.some((part) => /(^|[^\w$.])validateModel\s*\(/.test(part))
      ? ["import { validateModel } from '@reformer/core/validation';"]
      : []),
    ...operatorImportLines(intent.operators, code),
  ];
}

/** Тело хука: с `await` — асинхронная обёртка, чтобы хук вернул `void`, а не промис. */
function hookBody(expr: string): string {
  return /\bawait\b/.test(expr) ? `void (async () => { ${expr} })();` : expr;
}

/** Правило узла схемы → строка тела поведения. Узел — `schema.node(selector)`. */
function renderNodeRule(rule: NodeRuleIntent): string {
  const node = `schema.node(${tsString(rule.selector ?? '')})`;
  switch (rule.kind) {
    case 'onComponentEvent': {
      // Аргументы события — только если обработчик их читает: `noUnusedParameters`.
      const params = /\bargs\b/.test(rule.expr) ? '...args' : '';
      const async = /\bawait\b/.test(rule.expr) ? 'async ' : '';
      return `  onComponentEvent(${node}, ${tsString(rule.event ?? '')}, ${async}(${params}) => { ${rule.expr} });`;
    }
    case 'renderEffect':
      return `  renderEffect(schema, () => { ${hookBody(rule.expr)} });`;
    default:
      return `  ${rule.kind}(${node}, () => { ${hookBody(rule.expr)} });`;
  }
}

function renderBehavior(b: BehaviorIntent, intent: FormIntent, scope = 'model'): string {
  const path = (p: string): string => (scope === 'item' && b.each ? rowPath(p, b.each) : p);
  const target = `${scope}.$.${path(b.target)}`;
  const sources = b.sources.map((s) => `${scope}.$.${path(s)}`).join(', ');
  const opts = b.options ? `, ${JSON.stringify(b.options)}` : '';
  switch (b.kind) {
    case 'compute':
      return `  compute(${target}, () => ${b.expr ?? 'undefined'}${computeWhen(b)});`;
    case 'computeFrom': {
      // У связи строки параметры — по путям от строки: `items.qty` переименованием не считается.
      const { params, renamed } = callbackParams(b.sources.map(path));
      // Переименование названо на месте: выражение писал консумент, и оно ссылается на
      // ИСХОДНЫЕ имена — без этой строки расхождение он нашёл бы только по ошибке компиляции.
      const note =
        renamed.length > 0
          ? `  // параметры названы по последнему сегменту: ${renamed.join(', ')}\n`
          : '';
      return `${note}  computeFrom([${sources}], ${target}, (${params.join(', ')}) => ${b.expr ?? 'undefined'}${computeWhen(b)});`;
    }
    case 'copyFrom': {
      // `expr` копирования — его условие (`{ when }`; в intent его пишут и ключом `when`). Через
      // `options` функцию не передать — они печатаются JSON, и «копировать, пока стоит флаг»
      // было невыразимо (калибровка, кредитная заявка: `sameEmail`).
      const when = b.expr ? `when: () => ${b.expr}` : '';
      const rest = b.options ? JSON.stringify(b.options).slice(1, -1) : '';
      const all = [when, rest].filter(Boolean).join(', ');
      return `  copyFrom(${scope}.$.${path(b.sources[0] ?? 'source')}, ${target}${all ? `, { ${all} }` : ''});`;
    }
    case 'syncFields':
      return `  syncFields(${target}, ${scope}.$.${path(b.sources[0] ?? 'other')}${opts});`;
    case 'onChange': {
      // Параметр — только если выражение его читает: неиспользованный `value` не собирается под
      // `noUnusedParameters` (калибровка, кредитная заявка: три связи обходили это `void value;`).
      // Загрузка по значению (опции, префилл) — асинхронная реакция: `await` делает колбэк
      // `async`, а `signal` отменяет устаревший запрос, когда источник меняется снова.
      const expr = b.expr ?? '/* эффект */';
      const usesValue = /\bvalue\b/.test(expr);
      const params = /\bsignal\b/.test(expr)
        ? `${usesValue ? 'value' : '_value'}, { signal }`
        : usesValue
          ? 'value'
          : '';
      const async = /\bawait\b/.test(expr) ? 'async ' : '';
      return `  onChange(${target}, ${async}(${params}) => { ${expr} }${opts});`;
    }
    case 'enableWhen':
    case 'disableWhen':
      return `  ${b.kind}(${target}, () => ${b.expr ?? 'true'}${opts});`;
    case 'resetWhen':
      return `  resetWhen(${target}, () => ${b.expr ?? 'false'}${resetWhenOptions(b, intent)});`;
    case 'transformValue':
      return `  transformValue(${target}, (value) => ${b.expr ?? 'value'});`;
    case 'revalidateWhen':
      return `  revalidateWhen([${sources}], () => { ${b.expr ?? '/* перепроверка */'} });`;
    case 'exclusiveFlag': {
      // Флаг — поле строки; массив — `each`, а без него — путь флага до последнего сегмента.
      const each = b.each ?? b.target.split('.').slice(0, -1).join('.');
      return `  exclusiveFlag(model.$.${each}, (row) => row.$.${rowPath(b.target, each)});`;
    }
    case 'aggregateInto':
      return `  aggregateInto(model.$.${b.target}, (rows) => ${b.expr ?? '[]'});`;
    case 'call':
      // Свой оператор — вызов как есть: оператор из `operators` сам регистрирует свои связи.
      return `  ${(b.expr ?? '').replace(/;\s*$/, '')};`;
    default:
      return `  // неизвестный вид поведения: ${String(b.kind)}`;
  }
}

export function buildBehaviorTs(intent: FormIntent): string {
  const ops = behaviorOps(intent).sort();
  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Поведение формы «${intent.formName}» — реактивные связи над моделью.`);
  lines.push(' */');
  lines.push(
    `import { defineFormBehavior${ops.length ? `, ${ops.join(', ')}` : ''} } from '@reformer/core/behaviors';`
  );
  lines.push(...behaviorExtraImports(intent, false));
  lines.push(`import type { ${intent.interfaceName} } from './model';`);
  lines.push('');
  lines.push(
    `export const formBehavior = defineFormBehavior<${intent.interfaceName}>(({ model }) => {`
  );
  if (intent.behavior.length === 0) {
    lines.push('  // Поведения в intent не было — добавьте его здесь.');
  }
  lines.push(...renderBehaviors(intent));
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
/**
 * Что колбэк поведения берёт из области: `model` — всегда, `schema` — для правил узлов, `form` —
 * когда выражение обращается к узлам формы (`form.confirmPassword.clearIssues()`).
 *
 * Раньше область была только `{ model }`, и выражение, которое снимает замечания или меняет
 * свойства узла, давало `Cannot find name 'form'` — бандл не собирался, хотя intent описал ровно
 * то, что делает рабочая форма.
 */
function behaviorParams(intent: FormIntent, withNodes: boolean): string[] {
  const sources = behaviorCode(intent, withNodes);
  const uses = (name: string) => sources.some((s) => new RegExp(`(^|[^\\w$.])${name}\\.`).test(s));
  return [
    'model',
    ...(uses('form') ? ['form'] : []),
    ...(withNodes || uses('schema') ? ['schema'] : []),
  ];
}

export function buildFormBehaviorTs(intent: FormIntent): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  const nodeRules = intent.nodes ?? [];
  const withNodes =
    (intent.visibility.length > 0 || nodeRules.length > 0) && intent.target !== 'core';
  if (intent.visibility.length > 0 && !withNodes) {
    warnings.push(
      `Правил видимости: ${intent.visibility.length} — для таргета \`core\` они не напечатаны: ` +
        'правила узлов схемы исполняет рендерер, а здесь разметку рисует JSX. Запишите условия в ' +
        'компонентах шагов; чтобы поле при этом перестало валидироваться — `enableWhen`.'
    );
  }
  if (nodeRules.length > 0 && !withNodes) {
    warnings.push(
      `Правил узлов схемы (${[...new Set(nodeRules.map((rule) => rule.kind))].join(', ')}): ` +
        `${nodeRules.length} — для таргета \`core\` они не напечатаны: их исполняет рендерер. ` +
        'Обработчики и хуки запишите в JSX-разметке.'
    );
  }

  const ops = behaviorOps(intent);
  if (withNodes && intent.visibility.length > 0) ops.push('hideWhen');
  if (withNodes) ops.push(...new Set(nodeRules.map((rule) => rule.kind)));
  ops.sort();

  const lines: string[] = [];
  lines.push('/**');
  lines.push(
    withNodes
      ? ` * Поведение формы «${intent.formName}» — связи над моделью и правила узлов схемы.`
      : ` * Поведение формы «${intent.formName}» — реактивные связи над моделью.`
  );
  if (withNodes && intent.visibility.length > 0) {
    lines.push(' * Скрытие узла НЕ убирает поле из модели: чтобы оно перестало валидироваться,');
    lines.push(' * рядом нужен enableWhen.');
  }
  lines.push(' */');
  lines.push(
    `import { defineFormBehavior${ops.length ? `, ${ops.join(', ')}` : ''} } from '@reformer/core/behaviors';`
  );
  lines.push(...behaviorExtraImports(intent, withNodes));
  lines.push(`import type { ${intent.interfaceName} } from './model';`);
  lines.push('');
  lines.push(
    `export const formBehavior = defineFormBehavior<${intent.interfaceName}>(({ ${behaviorParams(
      intent,
      withNodes
    ).join(', ')} }) => {`
  );
  if (intent.behavior.length === 0 && !withNodes) {
    lines.push('  // Поведения в intent не было — добавьте его здесь.');
  }
  lines.push(...renderBehaviors(intent));
  if (withNodes && intent.visibility.length > 0) {
    if (intent.behavior.length > 0) lines.push('');
    lines.push('  // Видимость узлов схемы — по `selector`.');
    for (const v of intent.visibility) {
      lines.push(`  hideWhen(schema.node('${v.selector}'), () => ${v.condition});`);
    }
  }
  if (withNodes && nodeRules.length > 0) {
    if (intent.behavior.length > 0 || intent.visibility.length > 0) lines.push('');
    lines.push('  // События компонентов, эффекты рендера и хуки узлов схемы — по `selector`.');
    lines.push(...nodeRules.map(renderNodeRule));
  }
  lines.push('});');
  return { content: lines.join('\n') + '\n', warnings };
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
    used.add(a.component ?? 'FieldArray');
    for (const f of a.itemFields) used.add(f.component);
  }
  const walk = (node: LayoutNode) => {
    if (node.kind === 'container') {
      if (isWizardContainer(node)) used.add('FormWizard');
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
  for (const [from, names] of groupUiKitImports(['FormField', ...imports])) {
    lines.push(`import { ${names.join(', ')} } from '${from}';`);
  }
  lines.push(
    "import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';"
  );
  const sources = dataSourceNames(intent);
  if (sources.length > 0)
    lines.push(`import { ${[...sources].sort().join(', ')} } from './data-sources';`);
  lines.push('');
  lines.push('export function createRegistry(): ComponentRegistry {');
  lines.push('  return defineRegistry((reg) => {');
  lines.push('    // Системная обёртка листа: label + ошибки. Сборка кладёт её в бандл формы.');
  lines.push('    reg.component(FIELD_WRAPPER, FormField);');
  for (const c of extra) lines.push(`    reg.component('${c}', ${c});`);
  for (const c of known) lines.push(`    reg.component('${c}', ${COMPONENT_IMPORTS[c]});`);
  for (const c of unknown) lines.push(`    // TODO: reg.component('${c}', /* импорт */);`);
  // Значения — из `data-sources.ts` того же бандла (`buildDataSourcesTs`), под тем же именем.
  for (const name of dataSourceNames(intent)) lines.push(`    reg.dataSource('${name}', ${name});`);
  lines.push('  });');
  lines.push('}');
  return { content: lines.join('\n') + '\n', warnings };
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
/** Роль файла потока шагов — одна строка на все таргеты. */
const FLOW_ROLE =
  'поток шагов визарда: `FormFlowConfig` — шаги (`id` = `selector` узла шага) и их правила; ' +
  'подключается `createForm({ flow })`';

/** Роль файла своих операторов — одна строка на все таргеты. */
const OPERATORS_ROLE =
  'свои операторы: правила, операторы валидации и поведения, которые вызывает intent ' +
  '(`operators`); заготовку пишет `form_build`, тела — автор формы';

/** Роль файла словаря текстов замечаний — одна строка на все таргеты. */
const MESSAGES_ROLE =
  'словарь текстов замечаний (`defineIssueMessages`): код правила → текст; подключается ' +
  '`<ValidationMessagesProvider messages={…}>`';

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
    { path: 'form.flow.ts', role: FLOW_ROLE, optional: true },
    { path: 'form.messages.ts', role: MESSAGES_ROLE, optional: true },
    { path: 'data-sources.ts', role: 'справочники и списки значений' },
    { path: 'api.ts', role: 'загрузка и submit' },
    { path: 'operators.ts', role: OPERATORS_ROLE, optional: true },
    {
      path: 'form.intent.json',
      role: 'исходник формы для `form_build`: файлы с маркером сборки он пишет сам',
      optional: true,
    },
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
    { path: 'form.flow.ts', role: FLOW_ROLE, optional: true },
    { path: 'form.messages.ts', role: MESSAGES_ROLE, optional: true },
    { path: 'data-sources.ts', role: 'справочники и списки значений' },
    { path: 'api.ts', role: 'загрузка и submit' },
    { path: 'operators.ts', role: OPERATORS_ROLE, optional: true },
    {
      path: 'form.intent.json',
      role: 'исходник формы для `form_build`: файлы с маркером сборки он пишет сам',
      optional: true,
    },
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
    { path: 'form.flow.ts', role: FLOW_ROLE, optional: true },
    { path: 'form.messages.ts', role: MESSAGES_ROLE, optional: true },
    { path: 'data-sources.ts', role: 'справочники и списки значений' },
    { path: 'api.ts', role: 'загрузка и submit' },
    { path: 'operators.ts', role: OPERATORS_ROLE, optional: true },
    {
      path: 'form.intent.json',
      role: 'исходник формы для `form_build`: файлы с маркером сборки он пишет сам',
      optional: true,
    },
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
    'Модуль формы плоский, без каталогов ролей (их раскладка `folders` — для крупной формы); шаги wizard-а — ' +
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
  const flow = buildFormFlowTs(intent);
  if (flow !== null) files.push({ path: 'form.flow.ts', content: flow });
  const messages = buildMessagesTs(intent);
  if (messages.content !== null)
    files.push({ path: 'form.messages.ts', content: messages.content });
  warnings.push(...messages.warnings);
  const dataSources = buildDataSourcesTs(intent);
  if (dataSources.content !== null)
    files.push({ path: 'data-sources.ts', content: dataSources.content });
  warnings.push(...dataSources.warnings);

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
