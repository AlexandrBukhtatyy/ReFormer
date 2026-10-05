/**
 * Разметка формы единого контракта из `FormIntent`: документ JSON-DSL формата 2 и то же дерево
 * в TS.
 *
 * Один эмиттер на все таргеты. Сначала из intent строится документ (`buildSchemaDocument`) —
 * чистые данные со строковыми операторами: `$model(path)`, `$component(Name)`, `$part(name)`.
 * Дальше он либо отдаётся как есть (renderer-json), либо печатается в TS (`buildFormSchemaTs`):
 * оператор `$model(a.b)` становится ручкой `model.$.a.b`, `$component(Name)` — импортом
 * компонента, `$part(name)` — функцией части. Так TS- и JSON-разметка не могут разойтись: это
 * одно дерево в двух записях.
 *
 * Что изменилось относительно прежней разметки (`layoutToJson` в `builders.ts`, формат v1):
 * - привязка одним ключом `model` вместо `value` / `array`;
 * - шаги визарда — дети узла, а не `componentProps.steps`; визард — библиотечный `FormWizard`;
 * - строка массива и подформа — именованные части документа (`parts`);
 * - `initialValue` у массива не печатается: шаблон нового элемента объявлен в модели (`arrayOf`).
 */

import type { ArrayIntent, FieldIntent, FormIntent, LayoutNode } from './form-intent.js';
import { UI_KIT_CONTAINER_EXPORTS, UI_KIT_FIELD_EXPORTS } from './ui-kit-components.js';

/** Узел документа формата 2. Чем он является, решают ключи: `item` — массив, `part` — подформа. */
export interface SchemaDocNode {
  selector?: string;
  model?: string;
  component?: string;
  componentProps?: Record<string, unknown>;
  /** Шаблон строки массива: `$part(name)`. */
  item?: string;
  /** Подформа: `$part(name)`. */
  part?: string;
  children?: SchemaDocNode[];
}

/** Документ JSON-DSL формата 2. */
export interface SchemaDocument {
  format: 2;
  parts?: Record<string, SchemaDocNode>;
  root: SchemaDocNode;
}

/** Часть документа и то, к какой под-модели она относится, — нужно TS-печати для типа. */
interface PartInfo {
  /** Интерфейс элемента массива (`PropertyItem`) — у части-строки. */
  itemInterfaceName?: string;
  /** Путь группы первого подключения (`registrationAddress`) — у части-подформы. */
  groupPath?: string;
}

/** Документ плюс сведения, которых в самом документе нет. */
export interface SchemaLayout {
  document: SchemaDocument;
  /** Имя части → к чему она относится. */
  partInfo: Record<string, PartInfo>;
  /** Ключ правил каждого шага визарда (он же `selector` узла шага) — по порядку шагов. */
  stepKeys: string[];
  warnings: string[];
}

const lastSegment = (path: string): string => path.split('.').pop() ?? path;

/**
 * Ключ шага — `selector` узла шага и ключ его правил в `validation.steps`.
 *
 * Берётся заданный в intent `selector`; у шага без него — `step<N>`. Ключ обязан быть одним и
 * тем же в разметке и в правилах, поэтому считается здесь, в одном месте, для обоих эмиттеров.
 */
export function stepKeyOf(step: { selector?: string }, index: number): string {
  return step.selector?.trim() || `step${index + 1}`;
}

/** Шаги визарда в порядке обхода разметки. */
export function collectSteps(root: LayoutNode): Array<Extract<LayoutNode, { kind: 'step' }>> {
  const steps: Array<Extract<LayoutNode, { kind: 'step' }>> = [];
  const walk = (node: LayoutNode): void => {
    if (node.kind === 'step') steps.push(node);
    if (node.kind === 'container' || node.kind === 'step') node.children.forEach(walk);
  };
  walk(root);
  return steps;
}

/**
 * Узел поля. `path` — путь привязки В ОБЛАСТИ узла: от корня модели, от строки массива или от
 * группы подформы.
 *
 * `testId` печатается только там, где он однозначен: у поля корня — из пути модели, у поля
 * строки — с именем массива впереди (одноимённые листья разных массивов иначе совпали бы). У
 * поля подформы он не печатается вовсе: часть стоит в документе несколько раз, и один и тот же
 * идентификатор разрешился бы в несколько элементов — там его выводит рендерер, из полного пути
 * сигнала.
 */
function fieldNode(
  f: FieldIntent,
  path: string,
  testIdScope: { prefix?: string } | 'derived'
): SchemaDocNode {
  const props: Record<string, unknown> = { ...(f.componentProps ?? {}) };
  if (f.label) props.label = f.label;
  if (f.componentProps?.testId !== undefined) {
    props.testId = f.componentProps.testId;
  } else if (testIdScope !== 'derived') {
    props.testId = [testIdScope.prefix, path].filter(Boolean).join('.').replace(/\./g, '-');
  }
  if (f.optionsSource) props.options = `$dataSource(${f.optionsSource})`;
  return {
    selector: f.selector ?? f.name,
    model: `$model(${path})`,
    component: `$component(${f.component})`,
    ...(Object.keys(props).length > 0 ? { componentProps: props } : {}),
  };
}

/** Имя части, не занятое другой частью документа. */
function freeName(base: string, taken: Record<string, unknown>): string {
  if (!(base in taken)) return base;
  for (let i = 2; ; i++) if (!(`${base}${i}` in taken)) return `${base}${i}`;
}

/**
 * Построить документ формата 2 из intent.
 *
 * @returns Документ, сведения о частях для TS-печати и ключи шагов.
 */
export function buildSchemaLayout(intent: FormIntent): SchemaLayout {
  const parts: Record<string, SchemaDocNode> = {};
  const partInfo: Record<string, PartInfo> = {};
  const warnings: string[] = [];
  const steps = collectSteps(intent.layoutRoot);
  const stepKeys = steps.map(stepKeyOf);
  const rowPartOf = new Map<ArrayIntent, string>();

  /** Часть-строка массива: создаётся один раз на массив. */
  const rowPart = (a: ArrayIntent): string => {
    const known = rowPartOf.get(a);
    if (known) return known;
    const name = freeName(`${lastSegment(a.name)}Row`, { ...parts, ...(intent.parts ?? {}) });
    rowPartOf.set(a, name);
    parts[name] = {
      component: '$html(div)',
      children: a.itemFields.map((f) => fieldNode(f, f.modelPath ?? f.name, { prefix: a.name })),
    };
    partInfo[name] = { itemInterfaceName: a.itemInterfaceName };
    return name;
  };

  /** Часть-подформа: объявлена в intent, пути её полей — от группы подключения. */
  const groupPart = (name: string, groupPath: string): boolean => {
    if (name in parts) return true;
    const declared = intent.parts?.[name];
    if (!declared) {
      warnings.push(
        `Подформа ссылается на часть \`${name}\`, но в intent.parts её нет — узел пропущен.`
      );
      return false;
    }
    // Запись до обхода: часть, подключающая саму себя, не уводит обход в бесконечность.
    parts[name] = { component: '$html(div)' };
    partInfo[name] = { groupPath };
    const node = toNode(declared, groupPath);
    if (node) parts[name] = node;
    return true;
  };

  /** `scope` — путь группы, внутри части которой идёт обход; `null` — корень. */
  function toNode(node: LayoutNode, scope: string | null): SchemaDocNode | null {
    const absolute = (ref: string): string => (scope ? `${scope}.${ref}` : ref);
    switch (node.kind) {
      case 'field': {
        const path = absolute(node.ref);
        const f = intent.fields.find((x) => x.name === path || (x.modelPath ?? x.name) === path);
        if (!f) return null;
        // В части селектор — от группы: часть стоит в документе несколько раз, и полный путь
        // первого подключения был бы неверен для остальных. Свой селектор поля сохраняется.
        if (scope) {
          const own = f.selector && f.selector !== f.name ? f.selector : node.ref;
          return { ...fieldNode(f, node.ref, 'derived'), selector: own };
        }
        return fieldNode(f, f.modelPath ?? f.name, {});
      }
      case 'array': {
        const path = absolute(node.ref);
        const a = intent.arrays.find((x) => x.name === path || (x.modelPath ?? x.name) === path);
        if (!a) return null;
        return {
          // Заданный в layoutRoot `selector` побеждает имя массива: на него ссылаются правила
          // видимости, и подмена дала бы правило на узел, которого в разметке нет.
          selector: node.selector ?? a.name,
          model: `$model(${scope ? node.ref : (a.modelPath ?? a.name)})`,
          component: `$component(${a.component ?? 'FormArray'})`,
          item: `$part(${rowPart(a)})`,
        };
      }
      case 'part': {
        const groupPath = absolute(node.ref);
        if (!groupPart(node.part, groupPath)) return null;
        return {
          ...(node.selector ? { selector: node.selector } : {}),
          model: `$model(${node.ref})`,
          part: `$part(${node.part})`,
        };
      }
      case 'step': {
        const index = steps.indexOf(node);
        return {
          selector: stepKeyOf(node, index),
          component: '$component(Step)',
          componentProps: { title: node.title },
          children: childrenOf(node.children, scope),
        };
      }
      default: {
        const stepChildren = node.children.filter((c) => c.kind === 'step');
        // Контейнер, все дети которого — шаги, и есть визард: библиотечный `FormWizard` строит
        // шаги из узлов-детей, а форму и валидацию берёт из сборки сам.
        const isWizard = stepChildren.length > 0 && stepChildren.length === node.children.length;
        if (isWizard) {
          return {
            selector: node.selector ?? 'wizard',
            component: '$component(FormWizard)',
            ...(node.componentProps && Object.keys(node.componentProps).length > 0
              ? { componentProps: node.componentProps }
              : {}),
            children: childrenOf(node.children, scope),
          };
        }
        return {
          ...(node.selector ? { selector: node.selector } : {}),
          component: node.htmlTag ? `$html(${node.htmlTag})` : `$component(${node.component})`,
          ...(node.componentProps && Object.keys(node.componentProps).length > 0
            ? { componentProps: node.componentProps }
            : {}),
          children: childrenOf(node.children, scope),
        };
      }
    }
  }

  function childrenOf(children: LayoutNode[], scope: string | null): SchemaDocNode[] {
    return children
      .map((child) => toNode(child, scope))
      .filter((child): child is SchemaDocNode => child !== null);
  }

  const root = toNode(intent.layoutRoot, null) ?? { component: '$html(div)', children: [] };
  const document: SchemaDocument = {
    format: 2,
    ...(Object.keys(parts).length > 0 ? { parts } : {}),
    root,
  };
  return { document, partInfo, stepKeys, warnings };
}

/** Документ формата 2 строкой — содержимое `form.schema.json`. */
export function buildFormSchemaJson(intent: FormIntent): string {
  return JSON.stringify(buildSchemaLayout(intent).document, null, 2) + '\n';
}

// ---------------------------------------------------------------------------
// TS-печать
// ---------------------------------------------------------------------------

/** Имя в схеме → экспорт `@reformer/ui-kit`. */
const UI_KIT_IMPORTS: Readonly<Record<string, string>> = {
  ...UI_KIT_FIELD_EXPORTS,
  ...UI_KIT_CONTAINER_EXPORTS,
  FormWizard: 'FormWizard',
};

const OPERATOR = /^\$(model|component|html|dataSource|part)\(([^)]*)\)$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Что файлу схемы нужно импортировать — собирается по ходу печати. */
interface TsImports {
  uiKit: Set<string>;
  cdkWizard: Set<string>;
  dataSources: Set<string>;
  unknownComponents: Set<string>;
}

const quote = (text: string): string => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Путь модели → обращение к ручке: `a.b` → `model.$.a.b`, числовой сегмент → `[n]`. */
function handleOf(path: string): string {
  return path
    .split('.')
    .filter(Boolean)
    .reduce(
      (acc, segment) =>
        IDENTIFIER.test(segment)
          ? `${acc}.${segment}`
          : /^\d+$/.test(segment)
            ? `${acc}[${segment}]`
            : `${acc}[${quote(segment)}]`,
      'model.$'
    );
}

/** Значение документа → TS-выражение. Операторы становятся ссылками, остальное — литералами. */
function tsExpression(value: unknown, imports: TsImports): string | null {
  if (typeof value !== 'string') return null;
  const match = OPERATOR.exec(value);
  if (!match) return quote(value);
  const [, op, arg] = match;
  switch (op) {
    case 'model':
      return handleOf(arg);
    case 'html':
      return quote(arg);
    case 'part':
      return arg;
    case 'dataSource':
      imports.dataSources.add(arg);
      return arg;
    default: {
      if (arg === 'Step') {
        imports.cdkWizard.add('Step');
        return 'Step';
      }
      const exported = UI_KIT_IMPORTS[arg];
      if (exported) {
        imports.uiKit.add(exported);
        return exported;
      }
      imports.unknownComponents.add(arg);
      return arg;
    }
  }
}

/** Печать значения с отступом. Короткие объекты и списки без вложенности — в одну строку. */
function printTs(value: unknown, depth: number, imports: TsImports): string {
  const expression = tsExpression(value, imports);
  if (expression !== null) return expression;
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';

  const pad = '  '.repeat(depth + 1);
  const close = '  '.repeat(depth);
  const flat = (items: string[], open: string, end: string): string | null => {
    const line = `${open} ${items.join(', ')} ${end}`;
    return items.every((item) => !item.includes('\n')) && line.length <= 72 ? line : null;
  };

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => printTs(item, depth + 1, imports));
    const nested = value.some((item) => item !== null && typeof item === 'object');
    const inline = nested ? null : flat(items, '[', ']');
    return inline ?? `[\n${items.map((item) => `${pad}${item},`).join('\n')}\n${close}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined
  );
  if (entries.length === 0) return '{}';
  const items = entries.map(
    ([key, v]) => `${IDENTIFIER.test(key) ? key : quote(key)}: ${printTs(v, depth + 1, imports)}`
  );
  const nested = entries.some(([, v]) => v !== null && typeof v === 'object');
  const inline = nested ? null : flat(items, '{', '}');
  return inline ?? `{\n${items.map((item) => `${pad}${item},`).join('\n')}\n${close}}`;
}

/** Узел в каноническом порядке ключей — так его удобно читать: привязка, компонент, дети. */
function ordered(node: SchemaDocNode): Record<string, unknown> {
  return {
    selector: node.selector,
    model: node.model,
    component: node.component,
    componentProps: node.componentProps,
    item: node.item,
    part: node.part,
    children: node.children?.map(ordered),
  };
}

/** Импорт списком имён: длинный — по имени на строку, как его оставил бы форматтер. */
function importLine(names: string[], from: string): string {
  const inline = `import { ${names.join(', ')} } from '${from}';`;
  if (inline.length <= 100) return inline;
  return `import {\n${names.map((name) => `  ${name},`).join('\n')}\n} from '${from}';`;
}

/** Тип под-модели части: интерфейс элемента массива либо тип группы по пути в модели. */
function partModelType(info: PartInfo | undefined, interfaceName: string): string {
  if (info?.itemInterfaceName) return info.itemInterfaceName;
  if (info?.groupPath) {
    return info.groupPath
      .split('.')
      .filter(Boolean)
      .reduce((acc, segment) => `${acc}[${quote(segment)}]`, interfaceName);
  }
  return 'Record<string, unknown>';
}

/**
 * `form.schema.ts` — разметка формы в TS: одно дерево, по которому сборка `createForm` строит
 * форму, а `FormRenderer` рисует разметку. Вариант «React руками» берёт из неё только поля.
 *
 * @returns Содержимое файла и предупреждения (компонент вне таблицы импортов ui-kit).
 */
export function buildFormSchemaTs(intent: FormIntent): { content: string; warnings: string[] } {
  const { document, partInfo, warnings } = buildSchemaLayout(intent);
  const imports: TsImports = {
    uiKit: new Set(),
    cdkWizard: new Set(),
    dataSources: new Set(),
    unknownComponents: new Set(),
  };

  const partBlocks = Object.entries(document.parts ?? {}).map(([name, node]) => {
    const type = partModelType(partInfo[name], intent.interfaceName);
    const doc = partInfo[name]?.itemInterfaceName
      ? 'Строка массива: пути — от элемента. Шаблон нового элемента объявлен в `model.ts`.'
      : 'Подформа: пути — от группы, к которой часть подключена.';
    return (
      `/** ${doc} */\n` +
      `const ${name} = (model: FormModel<${type}>): FormSchemaNode => ` +
      `(${printTs(ordered(node), 0, imports)});\n`
    );
  });
  const rootBlock =
    `export const formSchema = (model: FormModel<${intent.interfaceName}>): FormSchemaNode => ` +
    `(${printTs(ordered(document.root), 0, imports)});\n`;

  const modelTypes = [
    intent.interfaceName,
    ...new Set(
      Object.values(partInfo)
        .map((info) => info.itemInterfaceName)
        .filter((name): name is string => Boolean(name))
    ),
  ];

  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Схема формы «${intent.formName}» — одно дерево узлов на все способы реализации.`);
  lines.push(' *');
  lines.push(
    ' * Узел привязан к модели ключом `model`: поле, массив под-форм (`item`) или подформа'
  );
  lines.push(
    ' * (`part`). По этому дереву сборка `createForm` строит форму, а `FormRenderer` рисует'
  );
  lines.push(' * разметку. Кто рисует разметку сам, в JSX, берёт из схемы только поля.');
  lines.push(' */');
  lines.push("import type { FormModel, FormSchemaNode } from '@reformer/core';");
  if (imports.cdkWizard.size > 0) {
    lines.push(
      `import { ${[...imports.cdkWizard].sort().join(', ')} } from '@reformer/cdk/form-wizard';`
    );
  }
  if (imports.uiKit.size > 0) {
    lines.push(importLine([...imports.uiKit].sort(), '@reformer/ui-kit'));
  }
  for (const name of [...imports.unknownComponents].sort()) {
    lines.push(`// TODO: импортируйте компонент \`${name}\` — его нет в таблице импортов ui-kit.`);
    warnings.push(
      `Компонент \`${name}\` не в курируемой таблице импортов — в form.schema.ts стоит TODO.`
    );
  }
  if (imports.dataSources.size > 0) {
    lines.push(importLine([...imports.dataSources].sort(), './data-sources'));
  }
  lines.push(`import type { ${modelTypes.join(', ')} } from './model';`);
  lines.push('');
  for (const block of partBlocks) lines.push(block);
  lines.push(rootBlock.trimEnd());
  return { content: lines.join('\n') + '\n', warnings };
}

/**
 * `form.schema.ts` для renderer-json — документ формата 2, обёрнутый в `defineJsonSchema<T>`.
 *
 * Обёртка типизирует литерал по модели: опечатка внутри `$model(...)` корневого дерева не
 * собирается. Пути внутри частей относительны под-модели и остаются непроверенными — как и у
 * чистого `.json`.
 */
export function buildFormSchemaJsonTs(intent: FormIntent): string {
  const literal = buildFormSchemaJson(intent).trimEnd();
  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Схема формы «${intent.formName}» — документ JSON-DSL формата 2.`);
  lines.push(' *');
  lines.push(' * Обёртка `defineJsonSchema<T>` — не украшение: она типизирует литерал по модели,');
  lines.push(' * поэтому опечатка внутри `$model(...)` не собирается, а не всплывает в рантайме.');
  lines.push(' * Пути внутри частей (`parts`) относительны под-модели и типом не проверяются.');
  lines.push(' */');
  lines.push("import { defineJsonSchema } from '@reformer/renderer-json';");
  lines.push('');
  lines.push(`import type { ${intent.interfaceName} } from './model';`);
  lines.push('');
  lines.push(`export const formSchema = defineJsonSchema<${intent.interfaceName}>(${literal});`);
  return lines.join('\n') + '\n';
}
