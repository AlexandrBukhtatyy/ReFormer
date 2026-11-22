/**
 * Записи каталога из экспортов входа и конфига: роли, классификация, пропсы, отказы.
 *
 * Перенесено из генератора `@reformer/ui-kit` (`scripts/generate-catalog.ts`: `propToSchema`,
 * `buildProperties`, `requirePaletteRecord`) с обобщением: что ui-kit знал таблицами про себя,
 * здесь говорит конфиг кита.
 *
 * ## Отказы
 *
 * Генерация отказывает, а не пропускает молча, — тихий пропуск обнаружился бы только невидимым
 * узлом на канвасе или формой, импортирующей несуществующее имя:
 *
 * - имя из конфига без записи или экспорта (`catalog-config-invalid` / `catalog-symbol-missing`);
 * - запись с именем синтетики билдера (`Wizard`, `Step`, `$html…`; `FieldArray` — в палитре);
 * - символ записи, `kit.infra` или `kit.adapters` не экспортирован входом;
 * - у палитровой записи не выведен тип пропсов;
 * - нарушена биекция «статика `reformerAdapter` ↔ `fields`»;
 * - тип значения поля не самодостаточен (ссылается на типы пакетов);
 * - статика экспорта без решения в `statics`.
 *
 * @module @reformer/builder-plugin-cli/catalog/records
 */

import type { CatalogRuntimePropDoc } from '@reformer/builder-plugin-api';
import type * as TS from 'typescript';

import type { Finding } from '../commands/findings.js';
import {
  FIELD_WRAPPER_PRESETS,
  groupByName,
  SEAM_RUNTIME_PROPS,
  type CatalogPropSchema,
  type KitCatalogConfig,
  type KitFieldConfig,
  type KitPropGroupRule,
  type KitRecordConfig,
} from './config.js';
import { orderPropSchema } from './emit.js';
import type { ExportInfo, KitIntrospector, PropInfo, RawProp } from './introspect.js';
import {
  compareCodePoints,
  inheritsOf,
  keepProp,
  NEVER_KEEP,
  type ReactNameSets,
} from './policy.js';
import type { TypeScriptModule } from './program.js';

type JsonObject = { [key: string]: unknown };

/**
 * Имена синтетических записей билдера. `Wizard`/`Step` — палитровый визард, `$html(…)` —
 * HTML-блоки; запись кита с таким именем спорила бы с ними в палитре. `FieldArray` кит иметь
 * вправе — так билдер узнаёт компонент массива, — но только вне палитры (`palette: false`).
 */
const SYNTHETIC_ALWAYS = new Set(['Wizard', 'Step']);
const SYNTHETIC_IN_PALETTE = new Set(['FieldArray']);

/** Встроенные типы, из которых складывается самодостаточный тип значения поля. */
const PORTABLE_TYPE_NAMES = new Set([
  'Array',
  'Blob',
  'Date',
  'File',
  'FileList',
  'Map',
  'NonNullable',
  'Omit',
  'Partial',
  'Pick',
  'Readonly',
  'ReadonlyArray',
  'ReadonlyMap',
  'ReadonlySet',
  'Record',
  'Required',
  'Set',
]);

/** Сколько имён показывать в одной заметке. */
const NOTICE_NAMES = 20;

export interface RecordsInput {
  readonly ts: TypeScriptModule;
  readonly config: KitCatalogConfig;
  readonly introspector: KitIntrospector;
  readonly exports: readonly ExportInfo[];
  /** Имя файла конфига для замечаний. */
  readonly configFile: string;
}

export interface RecordsResult {
  readonly components: JsonObject[];
  readonly categoryByName: Record<string, string>;
  readonly order: string[];
  readonly findings: Finding[];
  readonly notices: string[];
  /** Сколько записей в палитре. */
  readonly paletteCount: number;
}

/** Запись, которую предстоит построить. */
interface Planned {
  readonly name: string;
  readonly exportName: string;
  readonly role: 'field' | 'container';
  readonly field?: KitFieldConfig;
  readonly record?: KitRecordConfig;
}

function entriesOf<T>(map: Readonly<Record<string, T>> | undefined): [string, T][] {
  return Object.entries(map ?? {}).sort(([a], [b]) => compareCodePoints(a, b));
}

function listNames(names: readonly string[]): string {
  const shown = names.slice(0, NOTICE_NAMES).join(', ');
  return names.length > NOTICE_NAMES ? `${shown} … (+${names.length - NOTICE_NAMES})` : shown;
}

/** Секция инспектора пропа по правилу конфига; не узнан — `Behavior`. */
function groupOf(rule: KitPropGroupRule | undefined, prop: string): string {
  if (typeof rule === 'function') return rule(prop) ?? groupByName(prop) ?? 'Behavior';
  return rule?.[prop] ?? groupByName(prop) ?? 'Behavior';
}

/**
 * Один проп → узел JSON Schema с `x-doc`. Структура (`type`/`enum`/`default`) — из типов;
 * без JSON-типа проп показывается в инспекторе только для чтения, но каталог о нём сообщает.
 */
export function propToSchema(info: PropInfo, rule: KitPropGroupRule | undefined): JsonObject {
  return {
    ...(info.jsonType === undefined ? {} : { type: info.jsonType }),
    ...(info.enum === undefined ? {} : { enum: [...info.enum] }),
    ...(info.default === undefined ? {} : { default: info.default }),
    ...(info.description === undefined ? {} : { description: info.description }),
    'x-doc': {
      group: groupOf(rule, info.name),
      type: info.tsType,
      ...(info.jsonType === undefined ? { kind: 'readonly' } : {}),
    },
  };
}

/** Слияние уточнения поверх схемы пропа; `x-doc` сливается поключево. */
function mergePropSchema(base: JsonObject, patch: CatalogPropSchema): JsonObject {
  const merged: JsonObject = { ...base, ...patch };
  const baseDoc = base['x-doc'];
  const patchDoc = patch['x-doc'];
  if (typeof baseDoc === 'object' && baseDoc !== null && patchDoc !== undefined) {
    merged['x-doc'] = { ...baseDoc, ...patchDoc };
  }
  return orderPropSchema(merged);
}

/**
 * Проблема с типом значения поля; `undefined` — тип самодостаточен. Самодостаточный — без
 * импортов, `typeof` и ссылок на типы пакетов: его читают стеки без доступа к типам кита.
 */
export function portableTypeProblem(ts: TypeScriptModule, text: string): string | undefined {
  if (text.trim() === '') return 'тип пуст';
  const source = `type __Value = ${text};`;
  const syntax = ts.transpileModule(source, { reportDiagnostics: true }).diagnostics ?? [];
  if (syntax.length > 0) {
    return `не разбирается как тип TypeScript (${ts.flattenDiagnosticMessageText(syntax[0]?.messageText ?? '', ' ')})`;
  }
  const sf = ts.createSourceFile('value.ts', source, ts.ScriptTarget.Latest, true);
  const alias = sf.statements[0];
  if (sf.statements.length !== 1 || alias === undefined || !ts.isTypeAliasDeclaration(alias)) {
    return 'это не один тип';
  }
  let problem: string | undefined;
  const visit = (node: TS.Node): void => {
    if (problem !== undefined) return;
    if (ts.isImportTypeNode(node)) {
      problem = 'импортирует тип из модуля';
      return;
    }
    if (ts.isTypeQueryNode(node)) {
      problem = 'ссылается на значение (typeof)';
      return;
    }
    if (ts.isTypeReferenceNode(node)) {
      const name = ts.isIdentifier(node.typeName) ? node.typeName.text : undefined;
      if (name === undefined || !PORTABLE_TYPE_NAMES.has(name)) {
        problem = `ссылается на тип «${node.typeName.getText(sf)}» — его нет среди встроенных`;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(alias.type);
  return problem;
}

/** Строит записи каталога. Ничего не бросает: отказы — замечания. */
export function buildRecords(input: RecordsInput): RecordsResult {
  const { config, introspector, exports, ts } = input;
  const file = input.configFile;
  const findings: Finding[] = [];
  const notices: string[] = [];
  const configInvalid = (message: string): void => {
    findings.push({ code: 'catalog-config-invalid', message, file });
  };
  const symbolMissing = (message: string): void => {
    findings.push({ code: 'catalog-symbol-missing', message, file });
  };

  const byExport = new Map(exports.map((info) => [info.name, info]));
  const excluded = new Set(config.exclude ?? []);
  for (const name of [...excluded].sort(compareCodePoints)) {
    if (!byExport.has(name)) configInvalid(`exclude: экспорта «${name}» у входа кита нет`);
  }

  // ── Записи: поля, настроенные записи, остальные экспорты-компоненты ──
  const planned = new Map<string, Planned>();
  const coveredBy = new Map<string, string>();
  const plan = (where: string, entry: Planned): void => {
    const info = byExport.get(entry.exportName);
    if (info === undefined) {
      symbolMissing(`${where}: экспорта «${entry.exportName}» у входа кита нет`);
      return;
    }
    if (!info.component) {
      configInvalid(`${where}: экспорт «${entry.exportName}» — не компонент`);
      return;
    }
    if (excluded.has(entry.exportName)) {
      configInvalid(`${where}: экспорт «${entry.exportName}» исключён (exclude)`);
      return;
    }
    const previous = coveredBy.get(entry.exportName);
    if (previous !== undefined) {
      configInvalid(
        `${where}: экспорт «${entry.exportName}» уже описывает запись «${previous}» — у символа одна запись`
      );
      return;
    }
    if (planned.has(entry.name)) {
      configInvalid(`${where}: запись «${entry.name}» объявлена дважды`);
      return;
    }
    planned.set(entry.name, entry);
    coveredBy.set(entry.exportName, entry.name);
  };

  for (const [name, field] of entriesOf(config.fields)) {
    if (field.propsFrom !== undefined && !byExport.has(field.propsFrom)) {
      symbolMissing(`fields.${name}.propsFrom: экспорта «${field.propsFrom}» у входа кита нет`);
    }
    plan(`fields.${name}`, { name, exportName: field.exportName ?? name, role: 'field', field });
  }
  for (const [name, record] of entriesOf(config.records)) {
    if (config.fields?.[name] !== undefined) {
      configInvalid(`records.${name}: это поле — оно настраивается в fields`);
      continue;
    }
    if (record.propsFrom !== undefined && !byExport.has(record.propsFrom)) {
      symbolMissing(`records.${name}.propsFrom: экспорта «${record.propsFrom}» у входа кита нет`);
    }
    plan(`records.${name}`, {
      name,
      exportName: record.exportName ?? name,
      role: 'container',
      record,
    });
  }
  for (const info of exports) {
    if (!info.component || excluded.has(info.name) || coveredBy.has(info.name)) continue;
    const clash = planned.get(info.name);
    if (clash !== undefined) {
      configInvalid(
        `запись «${info.name}» описывает «${clash.exportName}», а у входа есть и экспорт «${info.name}» — ` +
          'исключите его (exclude) или назовите запись иначе'
      );
      continue;
    }
    plan(info.name, { name: info.name, exportName: info.name, role: 'container' });
  }

  // ── Биекция «статика reformerAdapter ↔ fields» ──
  const fieldExports = new Set(
    [...planned.values()].filter((p) => p.role === 'field').map((p) => p.exportName)
  );
  for (const info of exports) {
    if (info.fieldAdapter && !fieldExports.has(info.name)) {
      configInvalid(
        `экспорт «${info.name}» несёт статику reformerAdapter — это поле формы, а fields его не описывает`
      );
    }
  }
  for (const entry of planned.values()) {
    if (entry.role === 'field' && byExport.get(entry.exportName)?.fieldAdapter !== true) {
      configInvalid(
        `fields.${entry.name}: у экспорта «${entry.exportName}» нет статики reformerAdapter — полем формы он себя не объявляет`
      );
    }
  }

  // ── Статики ──
  const decisions = config.statics ?? {};
  const discovered = new Set(
    exports.flatMap((info) => info.statics.map((s) => `${info.name}.${s}`))
  );
  for (const [key, decision] of entriesOf(decisions)) {
    if (!discovered.has(key)) {
      configInvalid(`statics: статики «${key}» у экспортов входа нет`);
      continue;
    }
    if (decision !== 'ignore') {
      const target = byExport.get(decision);
      if (target === undefined) {
        symbolMissing(`statics.${key}: плоского экспорта «${decision}» у входа кита нет`);
      } else if (!target.component) {
        configInvalid(`statics.${key}: экспорт «${decision}» — не компонент`);
      }
    }
  }
  const undecided = new Set<string>();
  for (const entry of planned.values()) {
    const info = byExport.get(entry.exportName);
    for (const name of info?.statics ?? []) {
      const key = `${entry.exportName}.${name}`;
      if (decisions[key] === undefined) undecided.add(key);
    }
  }
  if (undecided.size > 0) {
    configInvalid(
      `статики без решения в statics ('ignore' либо имя плоского экспорта кита): ` +
        [...undecided].sort(compareCodePoints).join(', ')
    );
  }

  // ── Классификация ──
  const recordNames = new Set(planned.keys());
  const requireRecord = (where: string, name: string): boolean => {
    if (recordNames.has(name)) return true;
    configInvalid(`${where}: записи «${name}» нет`);
    return false;
  };
  const categoryByName: Record<string, string> = {};
  const order: string[] = [];
  for (const [category, names] of Object.entries(config.categories ?? {})) {
    order.push(category);
    for (const name of names) {
      if (!requireRecord(`categories.${category}`, name)) continue;
      const previous = categoryByName[name];
      if (previous !== undefined) {
        configInvalid(
          `categories: запись «${name}» в двух разделах — «${previous}» и «${category}»`
        );
        continue;
      }
      categoryByName[name] = category;
    }
  }
  const paletteList = new Set(config.palette ?? []);
  const limited = new Map(entriesOf(config.limited));
  const service = new Set(config.service ?? []);
  const leaves = new Set(config.leaves ?? []);
  const parts = new Map(entriesOf(config.parts));
  for (const name of paletteList) requireRecord('palette', name);
  for (const name of limited.keys()) requireRecord('limited', name);
  for (const name of service) requireRecord('service', name);
  for (const name of leaves) requireRecord('leaves', name);
  for (const [part, parent] of parts) {
    requireRecord('parts', part);
    if (requireRecord(`parts.${part}`, parent) && part === parent) {
      configInvalid(`parts.${part}: запись не может быть частью самой себя`);
    }
  }
  const explicitPalette = new Set([
    ...Object.keys(categoryByName),
    ...paletteList,
    ...limited.keys(),
    ...parts.keys(),
  ]);
  for (const name of [...service].sort(compareCodePoints)) {
    if (explicitPalette.has(name)) {
      configInvalid(`«${name}» одновременно служебная (service) и в палитре`);
    }
  }
  const isPalette = (entry: Planned): boolean =>
    !service.has(entry.name) && (entry.role === 'field' || explicitPalette.has(entry.name));
  const unclassified = [...planned.values()]
    .filter((p) => p.role !== 'field' && !explicitPalette.has(p.name) && !service.has(p.name))
    .map((p) => p.name)
    .sort(compareCodePoints);
  if (unclassified.length > 0) {
    if (config.unclassified === 'refuse') {
      configInvalid(
        `экспорты без роли (categories/palette/limited/parts/service/exclude): ${unclassified.join(', ')}`
      );
    } else {
      notices.push(
        `без роли в конфиге — записаны служебными (palette: false): ${listNames(unclassified)}`
      );
    }
  }

  // ── Синтетика билдера ──
  for (const entry of planned.values()) {
    if (SYNTHETIC_ALWAYS.has(entry.name) || entry.name.startsWith('$')) {
      configInvalid(
        `запись «${entry.name}» совпадает с синтетической записью билдера — исключите экспорт (exclude) ` +
          'или назовите запись иначе (records)'
      );
    } else if (SYNTHETIC_IN_PALETTE.has(entry.name) && isPalette(entry)) {
      configInvalid(
        `запись «${entry.name}» в палитре совпадает с синтетической записью билдера — кит вправе ` +
          'держать её только служебной (service)'
      );
    }
  }

  // ── Символы блока kit ──
  for (const [role, symbol] of entriesOf(config.kit.infra as Record<string, string> | undefined)) {
    if (!byExport.has(symbol))
      symbolMissing(`kit.infra.${role}: экспорта «${symbol}» у входа кита нет`);
  }
  for (const [role, adapter] of entriesOf(
    config.kit.adapters as Record<string, { symbol: string; subpath?: string } | null> | undefined
  )) {
    if (adapter === null || adapter.subpath !== undefined) continue;
    if (!byExport.has(adapter.symbol)) {
      symbolMissing(`kit.adapters.${role}: экспорта «${adapter.symbol}» у входа кита нет`);
    }
  }

  // ── Пропсы ──
  const props = config.props ?? {};
  const sets: ReactNameSets = { domEvents: introspector.domEvents() };
  const selectorKinds = ['pick', 'omit', 'override'] as const;
  for (const kind of selectorKinds) {
    for (const selector of Object.keys(props[kind] ?? {}).sort(compareCodePoints)) {
      if (selector === '*' || selector === '@field' || selector === '@container') continue;
      if (!recordNames.has(selector)) {
        configInvalid(
          `props.${kind}: селектор «${selector}» — ни запись, ни '*', '@field', '@container'`
        );
      }
    }
  }
  for (const [selector, names] of entriesOf(props.pick)) {
    for (const name of names) {
      if (NEVER_KEEP.has(name)) {
        configInvalid(`props.pick.${selector}: «${name}» не бывает пропсом схемы`);
      }
    }
  }
  /** Сработал ли групповой селектор хоть на одной записи: `kind|selector|prop`. */
  const groupUse = new Map<string, boolean>();
  const markGroup = (key: string, used: boolean): void => {
    groupUse.set(key, (groupUse.get(key) ?? false) || used);
  };

  const wrapper =
    config.fieldWrapper === false
      ? {}
      : typeof config.fieldWrapper === 'object'
        ? config.fieldWrapper
        : FIELD_WRAPPER_PRESETS.reformer;
  const seam = config.fieldSeam ?? SEAM_RUNTIME_PROPS;

  const components: JsonObject[] = [];
  const withoutProps: string[] = [];
  const partial: string[] = [];
  const deprecatedInPalette: string[] = [];
  let paletteCount = 0;

  for (const entry of [...planned.values()].sort((a, b) => compareCodePoints(a.name, b.name))) {
    const palette = isPalette(entry);
    if (palette) paletteCount++;
    if (palette && byExport.get(entry.exportName)?.deprecated === true) {
      deprecatedInPalette.push(entry.name);
    }
    const source = byExport.get(
      entry.field?.propsFrom ?? entry.record?.propsFrom ?? entry.exportName
    );
    let propsSchema: JsonObject;

    if (source?.props === undefined) {
      if (palette) {
        configInvalid(
          `запись «${entry.name}» в палитре, но тип пропсов «${entry.exportName}» не выведен — ` +
            `укажите ${entry.role === 'field' ? 'fields' : 'records'}.${entry.name}.propsFrom или уберите запись из палитры`
        );
        continue;
      }
      withoutProps.push(entry.name);
      propsSchema = { type: 'object', additionalProperties: true };
    } else {
      if (source.partial) partial.push(entry.name);
      const kept = new Map<string, RawProp>();
      const skipped = new Map<string, RawProp>();
      for (const raw of source.props) {
        // `__scope*` и родня — внутренняя кухня библиотек, не публичный API.
        if (raw.name.startsWith('__')) continue;
        (keepProp(raw.origin, sets) ? kept : skipped).set(raw.name, raw);
      }
      const selectors = ['*', entry.role === 'field' ? '@field' : '@container', entry.name];
      const has = (name: string): boolean => kept.has(name) || skipped.has(name);

      for (const selector of selectors) {
        const group = selector !== entry.name;
        for (const name of props.pick?.[selector] ?? []) {
          if (NEVER_KEEP.has(name)) continue;
          const raw = skipped.get(name);
          if (raw !== undefined) {
            skipped.delete(name);
            kept.set(name, raw);
          }
          if (group) markGroup(`pick|${selector}|${name}`, has(name));
          else if (!has(name))
            configInvalid(`props.pick.${selector}: пропа «${name}» у записи нет`);
        }
        for (const name of props.omit?.[selector] ?? []) {
          const present = has(name);
          kept.delete(name);
          if (group) markGroup(`omit|${selector}|${name}`, present);
          else if (!present) configInvalid(`props.omit.${selector}: пропа «${name}» у записи нет`);
        }
      }

      const runtimeNames = new Set<string>();
      if (entry.role === 'field') {
        for (const name of [
          'value',
          'onChange',
          ...Object.keys(seam),
          ...(entry.field?.seam ?? []),
          ...Object.keys(entry.field?.runtimeProps ?? {}),
        ]) {
          runtimeNames.add(name);
        }
      }

      const properties: Record<string, JsonObject> = {};
      for (const raw of kept.values()) {
        if (runtimeNames.has(raw.name)) continue;
        properties[raw.name] = propToSchema(introspector.describe(raw, source), props.groups);
      }
      if (entry.role === 'field') {
        for (const [name, schema] of Object.entries(wrapper)) {
          properties[name] = orderPropSchema({ ...schema });
        }
      }
      for (const selector of selectors) {
        const group = selector !== entry.name;
        for (const [name, patch] of entriesOf(props.override?.[selector])) {
          const base = properties[name];
          if (group) markGroup(`override|${selector}|${name}`, base !== undefined);
          if (base === undefined) {
            if (!group) {
              configInvalid(
                `props.override.${selector}: пропа «${name}» в properties записи нет — ` +
                  'уточнять можно только выведенный проп (чужой сначала верните через props.pick)'
              );
            }
            continue;
          }
          properties[name] = mergePropSchema(base, patch);
        }
      }

      const inherits = inheritsOf(
        [...skipped.values()].map((raw) => raw.origin),
        sets
      );
      propsSchema = {
        type: 'object',
        additionalProperties: false,
        properties,
        ...(entry.role === 'field' && entry.field !== undefined
          ? { 'x-runtimeProps': runtimePropsOf(entry.field, seam) }
          : {}),
        ...(inherits === null ? {} : { 'x-inherits': inherits }),
      };
    }

    if (entry.field !== undefined) {
      const problem = portableTypeProblem(ts, entry.field.value);
      if (problem !== undefined) {
        configInvalid(
          `fields.${entry.name}.value: тип значения «${entry.field.value}» ${problem} — нужен самодостаточный тип`
        );
      }
    }

    const tuning = entry.field ?? entry.record;
    const parent = parts.get(entry.name);
    const reason = limited.get(entry.name);
    components.push({
      name: entry.name,
      role: entry.role,
      ...(entry.exportName === entry.name ? {} : { exportName: entry.exportName }),
      ...(entry.record?.subpath === undefined ? {} : { subpath: entry.record.subpath }),
      ...(parent === undefined ? {} : { compoundParent: parent }),
      ...(tuning?.variantGroup === undefined ? {} : { variantGroup: tuning.variantGroup }),
      ...(tuning?.variant === undefined ? {} : { variant: tuning.variant }),
      ...(palette ? {} : { palette: false }),
      ...(reason === undefined ? {} : { preview: { mode: 'limited', reason } }),
      ...(leaves.has(entry.name) ? { leaf: true } : {}),
      ...(tuning?.classGroups === undefined ? {} : { classGroups: [...tuning.classGroups] }),
      propsSchema,
    });
  }

  for (const [key, used] of [...groupUse.entries()].sort(([a], [b]) => compareCodePoints(a, b))) {
    if (used) continue;
    const [kind, selector, name] = key.split('|');
    configInvalid(
      `props.${kind ?? ''}['${selector ?? ''}']: пропа «${name ?? ''}» нет ни у одной записи`
    );
  }

  if (withoutProps.length > 0) {
    notices.push(
      `тип пропсов не выведен — записаны без перечня пропсов (additionalProperties: true): ${listNames(withoutProps)}`
    );
  }
  if (partial.length > 0) {
    notices.push(
      `тип пропсов выведен частично (часть пересечения не разрешилась): ${listNames(partial)}`
    );
  }

  if (deprecatedInPalette.length > 0) {
    notices.push(`в палитре экспорты с @deprecated: ${listNames(deprecatedInPalette)}`);
  }

  return { components, categoryByName, order, findings, notices, paletteCount };
}

/** `x-runtimeProps` поля: шов, где `value`/`onChange` уточнены типом значения из конфига. */
function runtimePropsOf(
  field: KitFieldConfig,
  seam: Readonly<Record<string, CatalogRuntimePropDoc>>
): Record<string, CatalogRuntimePropDoc> {
  const out: Record<string, CatalogRuntimePropDoc> = {
    value: {
      group: 'Control',
      type: field.value,
      description: field.description ?? seam.value?.description ?? 'Значение поля.',
    },
    onChange: {
      group: 'Control',
      type: `(value: ${field.value}) => void`,
      description: field.onChangeDescription ?? seam.onChange?.description ?? 'Изменение значения.',
    },
  };
  for (const [name, doc] of Object.entries(seam)) {
    if (name !== 'value' && name !== 'onChange') out[name] = { ...doc };
  }
  for (const [name, doc] of Object.entries(field.runtimeProps ?? {})) out[name] = { ...doc };
  return out;
}
