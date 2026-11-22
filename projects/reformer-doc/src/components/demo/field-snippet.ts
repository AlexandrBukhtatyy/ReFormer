import type { IssueMessages } from '@reformer/core/i18n';
import { makeFieldVariant } from './field-demo';
import type { DemoFieldConfig } from './harness';
import type { ApiControl, ApiValues, VariantDef } from './types';

/**
 * Сниппеты узла поля для страниц компонентов кита. Код и живое демо строятся из одних и тех же
 * данных, поэтому вкладка «Код» не расходится с тем, что нарисовано в превью.
 */

/** Фрагмент кода, который печатается как есть (имя константы, вызов функции). */
export class RawCode {
  constructor(readonly code: string) {}
}

/** Вставить в сниппет код как есть: `raw('LOAN_TYPES')` → `LOAN_TYPES`. */
export function raw(code: string): RawCode {
  return new RawCode(code);
}

const INLINE_LIMIT = 60;

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function isIdentifier(key: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(key);
}

/** Литерал значения в синтаксисе TS: короткое — в строку, длинное — с переносами. */
function literal(value: unknown, indent: string): string {
  if (value instanceof RawCode) return value.code;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return `new Date(${quote(value.toISOString().slice(0, 10))})`;
  if (typeof value === 'function') return '/* функция */';
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    const items = value.map((v) => literal(v, inner));
    const flat = `[${items.join(', ')}]`;
    if (flat.length <= INLINE_LIMIT && !flat.includes('\n')) return flat;
    return `[\n${items.map((i) => `${inner}${i},`).join('\n')}\n${indent}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${isIdentifier(k) ? k : quote(k)}: ${literal(v, inner)}`);
    if (entries.length === 0) return '{}';
    const flat = `{ ${entries.join(', ')} }`;
    if (flat.length <= INLINE_LIMIT && !flat.includes('\n')) return flat;
    return `{\n${entries.map((e) => `${inner}${e},`).join('\n')}\n${indent}}`;
  }
  return String(value);
}

/** Пропсы, которые на вкладке API выставлены не в значение по умолчанию. */
function changedProps(controls: ApiControl[], values: ApiValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of controls) {
    if (c.kind === 'readonly' || c.prop === 'disabled') continue;
    const v = values[c.prop];
    if (v === undefined || v === c.default) continue;
    if (c.kind === 'text' && v === '') continue;
    out[c.prop] = v;
  }
  return out;
}

export interface FieldSnippetOptions {
  /** Путь поля в модели: `email` → `model.$.email`, `address.city` → `model.$.address.city`. */
  field: string;
  /** Имя компонента, как его импортируют из кита. */
  component: string;
  /** Пропсы узла, которые показываются всегда (в этом порядке). */
  props?: Record<string, unknown>;
  /** Контролы вкладки API и их текущие значения: в код попадает то, что отличается от умолчания. */
  controls?: ApiControl[];
  values?: ApiValues;
  /** Правила поля — содержимое массива `validate(model.$.x, [ … ])`. */
  rules?: string;
  /** Тексты замечаний по кодам правил — печатаются словарём `defineIssueMessages`. */
  messages?: IssueMessages;
  /** Начальное значение поля — печатается комментарием над узлом. */
  initial?: unknown;
}

/** Узел поля схемы формы (+ правила и словарь, если заданы) — сниппет для вкладки «Код». */
export function fieldSnippet(o: FieldSnippetOptions): string {
  const props = {
    ...(o.props ?? {}),
    ...(o.controls && o.values ? changedProps(o.controls, o.values) : {}),
  };
  const lines: string[] = [];
  if (o.initial !== undefined) {
    lines.push(`// начальное значение поля: ${literal(o.initial, '')}`);
  }
  lines.push('{');
  lines.push(`  model: model.$.${o.field},`);
  lines.push(`  component: ${o.component},`);
  const entries = Object.entries(props).filter(([, v]) => v !== undefined);
  if (entries.length > 0) {
    lines.push('  componentProps: {');
    for (const [k, v] of entries) {
      lines.push(`    ${isIdentifier(k) ? k : quote(k)}: ${literal(v, '    ')},`);
    }
    lines.push('  },');
  }
  lines.push('}');

  let code = lines.join('\n');
  if (o.values?.disabled === true) {
    code += `\n\n// блокировка — состоянием поля, а не пропом:\nform.${o.field}.disable();`;
  }
  if (o.rules) {
    code += `\n\n// правила — в схеме валидации (@reformer/core/validation):\nvalidate(model.$.${o.field}, [${o.rules}]);`;
  }
  if (o.messages && Object.keys(o.messages).length > 0) {
    code += `\n\n// тексты замечаний — в словаре сообщений формы:\ndefineIssueMessages(${literal(o.messages, '')});`;
  }
  return code;
}

export interface FieldVariantOptions extends Omit<
  DemoFieldConfig,
  'componentProps' | 'messages' | 'initial'
> {
  id: string;
  title: string;
  description?: string;
  /** Путь поля в модели для сниппета. */
  field: string;
  /** Имя компонента для сниппета. */
  componentName: string;
  /** Начальное значение поля. */
  initial: unknown;
  /** Показать начальное значение комментарием в коде (когда оно важно для примера). */
  showInitial?: boolean;
  /** Пропсы узла: одни и те же уходят в демо и в код. */
  props?: Record<string, unknown>;
  /** Пропсы только для демо, которых нет в коде (функции, большие данные) — с подменой в коде. */
  codeProps?: Record<string, unknown>;
  /** Правила для кода — должны соответствовать `validators`. */
  rules?: string;
  messages?: IssueMessages;
}

/** Карточка варианта/примера поля: демо и код из одних данных. */
export function fieldVariant(o: FieldVariantOptions): VariantDef {
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    render: makeFieldVariant({
      initial: o.initial,
      component: o.component,
      componentProps: o.props,
      validators: o.validators,
      messages: o.messages,
      disabled: o.disabled,
      touched: o.touched,
      fullWidth: o.fullWidth,
    }),
    code: fieldSnippet({
      field: o.field,
      component: o.componentName,
      props: { ...o.props, ...o.codeProps },
      values: o.disabled ? { disabled: true } : undefined,
      rules: o.rules,
      messages: o.messages,
      initial: o.showInitial ? o.initial : undefined,
    }),
  };
}
