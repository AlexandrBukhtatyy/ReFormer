#!/usr/bin/env tsx
/**
 * Интроспекция props-типов компонентов кита через TypeScript Compiler API — машинный источник
 * набора пропсов для `component-catalog.json`.
 *
 * Зачем: раньше набор пропсов записи каталога держался ручными `*.props.ts`. Ручной список
 * неизбежно отстаёт от кода (в каталоге 377 пропсов при ~1 500 реальных; медиана — 1 проп на
 * запись, 30 записей пустые, 91 часть compound'а несёт только `className`). Здесь набор
 * выводится ИЗ ТИПОВ, поэтому разойтись с кодом он не может: добавили проп в компонент —
 * он появился в каталоге на следующей сборке.
 *
 * Извлекается: JSON-тип (+`enum` для union'ов строковых литералов, В ПОРЯДКЕ ОБЪЯВЛЕНИЯ),
 * отображаемый TS-тип, `description` из JSDoc, обязательность и дефолт. Отбор — {@link './props-policy'}.
 *
 * ## Откуда берутся дефолты (и чего здесь принципиально не будет)
 *
 * Три машинных источника, в порядке приоритета: деструктуризация параметра компонента кита
 * (`function Button({ asChild = false })`, включая обёртки `forwardRef`/`memo`), `defaultVariants`
 * cva-конфига, JSDoc-тег `@defaultValue`.
 *
 * Чего НЕТ: дефолтов, заданных внутри реализации библиотеки (`modal = true` в radix, `openDelay = 700`
 * в hover-card, 16 дефолтов vaul). Кит такие пропсы просто спредит (`{...props}`), в `.d.ts` значения
 * не попадают, а разбирать бандлы `dist/index.mjs` двадцати пакетов — источник ошибок хуже отсутствия
 * данных. Их поставляет курированный оверлей с пометкой происхождения; набор пропсов при этом остаётся
 * машинным. Дыру нашли параллельные аудиты scroll-area/progress/hover-card/drawer/popover и др.
 *
 * CLI: `tsx scripts/introspect-props.ts [--dump <dir>]`.
 *
 * @module reformer-ui-kit/scripts/introspect-props
 */

import ts from 'typescript';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inheritsOf,
  keepProp,
  packageOf,
  skipReason,
  type PropOrigin,
  type ReactNameSets,
} from './props-policy';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = join(pkgRoot, 'src/components');

/** Один извлечённый проп в форме, близкой к JSON Schema (метаданные оверлея добавляются позже). */
export interface IntrospectedProp {
  name: string;
  /** JSON-тип; `undefined` — тип не выражается в JSON (функция, сложный объект). */
  jsonType?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Значения union'а строковых литералов в порядке объявления. */
  enum?: string[];
  /** Отображаемый TS-тип (`x-doc.type`): JSON Schema не выражает сигнатуры функций и `string | null`. */
  tsType: string;
  default?: string | number | boolean;
  /** Откуда взят дефолт — для аудита и для стража дрейфа. */
  defaultSource?: 'destructuring' | 'cva' | 'jsdoc';
  optional: boolean;
  description?: string;
  /** Пакет объявления: `ui-kit-src` — свой проп кита или cva-вариант. */
  origin: string;
  /** Проп объявлен cva-конфигом (`variant`/`size`), а не явным типом. */
  fromCva: boolean;
}

/** Разбор одного экспортируемого компонента. */
export interface IntrospectedComponent {
  name: string;
  dir: string;
  sourceFile: string;
  /**
   * `x-registryName` соседнего `*.props.ts` (конвенция `x.tsx` ↔ `x.props.ts`) — ключ, по которому
   * запись каталога находит свой экспорт. Имя записи (`Select`) часто не совпадает с именем
   * экспорта (`SelectAsync`), а другого моста между ними нет: `meta.ts` отдаёт только схемы.
   */
  registryName?: string;
  props: IntrospectedProp[];
  skipped: Array<{ name: string; reason: string }>;
  inherits: { react: string[]; packages: string[] } | null;
}

/** Разобранный cva-конфиг: порядок значений вариантов + дефолты. */
interface CvaConfig {
  variants: Map<string, string[]>;
  defaults: Map<string, string>;
}

// ── AST-хелперы ──────────────────────────────────────────────────────────────

/** Развернуть `forwardRef(fn)` / `memo(fn)` до самой функции компонента. */
function unwrapComponentFunction(node: ts.Node): ts.SignatureDeclaration | undefined {
  if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node))
    return node;
  if (ts.isVariableDeclaration(node) && node.initializer)
    return unwrapComponentFunction(node.initializer);
  // React.forwardRef(<inner>) / memo(<inner>) — компонент лежит первым аргументом.
  if (ts.isCallExpression(node) && node.arguments.length)
    return unwrapComponentFunction(node.arguments[0]);
  return undefined;
}

/** Литерал инициализатора деструктуризации → значение (учитывает унарный минус: `alignOffset = -4`). */
function literalValue(node: ts.Expression): string | number | boolean | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (
    ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(node.operand)
  ) {
    const n = Number(node.operand.text);
    return node.operator === ts.SyntaxKind.MinusToken ? -n : n;
  }
  return undefined;
}

/** Дефолты из деструктуризации параметра компонента: `function Button({ asChild = false })`. */
function destructuringDefaults(decl: ts.Declaration): Map<string, string | number | boolean> {
  const out = new Map<string, string | number | boolean>();
  const fn = unwrapComponentFunction(decl);
  const param = fn?.parameters?.[0];
  if (!param || !ts.isObjectBindingPattern(param.name)) return out;
  for (const el of param.name.elements) {
    if (!el.initializer) continue;
    const key = (el.propertyName ?? el.name).getText().replace(/^['"]|['"]$/g, '');
    const value = literalValue(el.initializer);
    if (value !== undefined) out.set(key, value);
  }
  return out;
}

/**
 * Все cva-конфиги файла по имени переменной: `const buttonVariants = cva(base, {...})`.
 * Именно по переменной, а не «один конфиг на файл»: в `attachment-base.tsx` их два, и общий кеш
 * по файлу приписывал `AttachmentAction.variant` дефолт `icon` от соседнего `attachmentMediaVariants`.
 */
function cvaConfigsOf(sf: ts.SourceFile): Map<string, CvaConfig> {
  const out = new Map<string, CvaConfig>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'cva' &&
      node.initializer.arguments.length > 1 &&
      ts.isObjectLiteralExpression(node.initializer.arguments[1])
    ) {
      const cfg: CvaConfig = { variants: new Map(), defaults: new Map() };
      for (const section of node.initializer.arguments[1].properties) {
        if (!ts.isPropertyAssignment(section) || !ts.isObjectLiteralExpression(section.initializer))
          continue;
        const sectionName = section.name.getText().replace(/^['"]|['"]$/g, '');
        if (sectionName === 'variants') {
          for (const variant of section.initializer.properties) {
            if (
              !ts.isPropertyAssignment(variant) ||
              !ts.isObjectLiteralExpression(variant.initializer)
            )
              continue;
            const key = variant.name.getText().replace(/^['"]|['"]$/g, '');
            cfg.variants.set(
              key,
              variant.initializer.properties
                .filter(ts.isPropertyAssignment)
                .map((v) => v.name.getText().replace(/^['"]|['"]$/g, ''))
            );
          }
        } else if (sectionName === 'defaultVariants') {
          for (const dv of section.initializer.properties)
            if (ts.isPropertyAssignment(dv) && ts.isStringLiteralLike(dv.initializer))
              cfg.defaults.set(dv.name.getText().replace(/^['"]|['"]$/g, ''), dv.initializer.text);
        }
      }
      out.set(node.name.text, cfg);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** cva-конфиг, который реально использует ЭТОТ компонент (по обращению к переменной в его теле). */
function cvaConfigFor(
  decl: ts.Declaration,
  configs: Map<string, CvaConfig>
): CvaConfig | undefined {
  if (configs.size === 0) return undefined;
  if (configs.size === 1) return [...configs.values()][0];
  const used: CvaConfig[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const cfg = configs.get(node.text);
      if (cfg && !used.includes(cfg)) used.push(cfg);
    }
    ts.forEachChild(node, visit);
  };
  visit(decl);
  if (!used.length) return undefined;
  // Компонент может звать несколько конфигов — сливаем в порядке обращения (первый выигрывает).
  const merged: CvaConfig = { variants: new Map(), defaults: new Map() };
  for (const cfg of used) {
    for (const [k, v] of cfg.variants) if (!merged.variants.has(k)) merged.variants.set(k, v);
    for (const [k, v] of cfg.defaults) if (!merged.defaults.has(k)) merged.defaults.set(k, v);
  }
  return merged;
}

/**
 * Объявление пропа, по которому судим о происхождении. При пересечении
 * `HTMLAttributes<HTMLDivElement> & { id?: … }` первой идёт декларация `@types/react`, из-за чего
 * собственный проп библиотеки классифицировался как HTML-атрибут и молча выпадал (нашли аудиты
 * resizable `id` и command `defaultValue`). Приоритет — у объявления вне `@types/react`.
 */
function pickDeclaration(sym: ts.Symbol): ts.Declaration | undefined {
  const decls = sym.declarations ?? [];
  return (
    decls.find((d) => !d.getSourceFile().fileName.replace(/\\/g, '/').includes('node_modules/')) ??
    decls.find((d) => packageOf(d.getSourceFile().fileName) !== '@types/react') ??
    decls[0]
  );
}

/** Имя интерфейса/типа, в котором объявлен проп (`DOMAttributes`, `SliderProps`, …). */
function ifaceOf(decl: ts.Declaration | undefined): string {
  let n: ts.Node | undefined = decl;
  while (n) {
    if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) return n.name.text;
    n = n.parent;
  }
  return '?';
}

/** Значение JSDoc-тега `@defaultValue` / `@default`, если библиотека его проставила. */
function jsdocDefault(sym: ts.Symbol): string | number | boolean | undefined {
  for (const tag of sym.getJsDocTags()) {
    if (tag.name !== 'defaultValue' && tag.name !== 'default') continue;
    const raw = ts.displayPartsToString(tag.text).trim().replace(/^`|`$/g, '');
    if (!raw) continue;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    return raw.replace(/^['"]|['"]$/g, '');
  }
  return undefined;
}

/**
 * Значения union'а строковых литералов В ПОРЯДКЕ ОБЪЯВЛЕНИЯ. Порядок из `type.types` — это порядок
 * резолва TS: `titleAs` приходил как `h2,h3,h1,h4,h5,h6`, а `variant` кнопки начинался с `link`.
 * Enum задаёт порядок опций в селекте инспектора, поэтому читаем узел типа из исходника.
 */
function stringLiteralUnion(type: ts.Type, decl: ts.Declaration | undefined): string[] | null {
  const declared = declaredUnionOrder(decl);
  const parts = type.isUnion() ? type.types : [type];
  const values: string[] = [];
  for (const t of parts) {
    if (t.getFlags() & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) continue;
    if (t.isStringLiteral()) values.push(t.value);
    else return null;
  }
  if (!values.length) return null;
  if (!declared) return values;
  // Порядок берём из объявления, но состав — из типа (объявление может быть alias'ом).
  const ordered = declared.filter((v) => values.includes(v));
  return ordered.length === values.length ? ordered : values;
}

/** Порядок литералов в узле типа объявления, если это union строковых литералов. */
function declaredUnionOrder(decl: ts.Declaration | undefined): string[] | null {
  if (!decl || !ts.isPropertySignature(decl) || !decl.type) return null;
  const node = decl.type;
  if (!ts.isUnionTypeNode(node)) return null;
  const out: string[] = [];
  for (const member of node.types) {
    if (member.kind === ts.SyntaxKind.UndefinedKeyword || member.kind === ts.SyntaxKind.NullKeyword)
      continue;
    if (ts.isLiteralTypeNode(member) && ts.isStringLiteralLike(member.literal))
      out.push(member.literal.text);
    else return null;
  }
  return out.length ? out : null;
}

/** TS-тип → JSON-тип. Функции/сложные объекты остаются без `jsonType` (в инспекторе — readonly). */
function jsonTypeOf(type: ts.Type, checker: ts.TypeChecker): IntrospectedProp['jsonType'] {
  const parts = (type.isUnion() ? type.types : [type]).filter(
    (t) => !(t.getFlags() & (ts.TypeFlags.Undefined | ts.TypeFlags.Null))
  );
  if (!parts.length) return undefined;
  const kinds = new Set(
    parts.map((t) => {
      const f = t.getFlags();
      if (f & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral)) return 'string';
      if (f & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) return 'number';
      if (f & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) return 'boolean';
      if (checker.isArrayType(t) || checker.isTupleType(t)) return 'array';
      if (t.getCallSignatures().length) return 'fn';
      if (f & ts.TypeFlags.Object) return 'object';
      return 'other';
    })
  );
  if (kinds.size !== 1) return undefined;
  const only = [...kinds][0];
  return only === 'fn' || only === 'other' ? undefined : (only as IntrospectedProp['jsonType']);
}

/**
 * Все пропсы типа, включая ветви дискриминированного union'а.
 *
 * `type.getProperties()` на union'е отдаёт только ОБЩИЕ для всех ветвей свойства, поэтому
 * `Accordion.collapsible` (есть лишь в ветке `single`) и `Calendar.selected`/`min`/`max`
 * (ветки `PropsSingle`/`PropsMulti`, у `{ mode?: undefined }` их нет) выпадали молча — ни в
 * `props`, ни в `skipped`. Общие свойства берём у самого union'а (там типы уже слиты, поэтому
 * `Accordion.type` сохраняет полный enum `single | multiple`), ветвевые — добавляем поверх.
 */
function allProperties(type: ts.Type): ts.Symbol[] {
  const common = type.getProperties();
  if (!type.isUnion()) return common;
  const merged = new Map(common.map((p) => [p.getName(), p]));
  for (const branch of type.types)
    for (const p of branch.getProperties())
      if (!merged.has(p.getName())) merged.set(p.getName(), p);
  return [...merged.values()];
}

/**
 * `x-registryName` из соседнего `*.props.ts` (`button-base.tsx` → `button-base.props.ts`).
 * Читается регуляркой, а не импортом: скрипт не должен грузить `.tsx`-граф ради одной строки.
 */
const registryNameCache = new Map<string, string | undefined>();
function registryNameOf(componentFile: string): string | undefined {
  if (registryNameCache.has(componentFile)) return registryNameCache.get(componentFile);
  const propsFile = componentFile.replace(/\.tsx$/, '.props.ts');
  let name: string | undefined;
  if (existsSync(propsFile)) {
    const m = /['"]x-registryName['"]\s*:\s*['"]([^'"]+)['"]/.exec(readFileSync(propsFile, 'utf8'));
    name = m?.[1];
  }
  registryNameCache.set(componentFile, name);
  return name;
}

/** Каталоги компонентов с `index.ts` (единая точка входа: те же имена, что видит каталог). */
function componentDirs(): string[] {
  return readdirSync(componentsDir).filter(
    (d) =>
      statSync(join(componentsDir, d)).isDirectory() &&
      existsSync(join(componentsDir, d, 'index.ts'))
  );
}

/** Сырой проп до применения политики (первый проход). */
interface RawProp {
  sym: ts.Symbol;
  origin: PropOrigin;
  decl: ts.Declaration | undefined;
}

/** Извлечь пропсы всех экспортируемых компонентов кита. Ключ результата — имя экспорта. */
export function introspectProps(): Map<string, IntrospectedComponent> {
  const dirs = componentDirs();
  const entries = dirs.map((d) => join(componentsDir, d, 'index.ts'));
  const cfgRaw = ts.readConfigFile(join(pkgRoot, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfgRaw.config, ts.sys, pkgRoot);
  const program = ts.createProgram(entries, { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker();
  const cvaCache = new Map<string, Map<string, CvaConfig>>();

  // ── проход 1: собрать сырые пропсы + набор имён DOM-событий из самих типов React ──
  type Collected = { dir: string; name: string; decl: ts.Declaration; raw: RawProp[] };
  const collected: Collected[] = [];
  const domEvents = new Set<string>();

  for (let i = 0; i < dirs.length; i++) {
    const sf = program.getSourceFile(entries[i]);
    if (!sf) continue;
    const moduleSym = checker.getSymbolAtLocation(sf);
    if (!moduleSym) continue;
    for (const ex of checker.getExportsOfModule(moduleSym)) {
      const name = ex.getName();
      if (!/^[A-Z]/.test(name)) continue;
      const aliased = ex.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(ex) : ex;
      const decl = aliased.valueDeclaration ?? aliased.declarations?.[0];
      if (!decl) continue;
      const sigs = checker.getTypeOfSymbolAtLocation(aliased, decl).getCallSignatures();
      if (!sigs.length) continue;
      const param = sigs[0].getParameters()[0];
      if (!param) continue;
      const propsType = checker.getTypeOfSymbolAtLocation(param, param.valueDeclaration ?? decl);

      const raw: RawProp[] = [];
      for (const sym of allProperties(propsType)) {
        const propDecl = pickDeclaration(sym);
        const declFile = propDecl?.getSourceFile().fileName ?? '';
        const iface = ifaceOf(propDecl);
        // Набор DOM-событий строим из самих типов: всё, что объявлено в React DOMAttributes.
        if (iface === 'DOMAttributes' && packageOf(declFile) === '@types/react')
          domEvents.add(sym.getName());
        raw.push({ sym, decl: propDecl, origin: { name: sym.getName(), declFile, iface } });
      }
      collected.push({ dir: dirs[i], name, decl, raw });
    }
  }

  const sets: ReactNameSets = { domEvents };

  // ── проход 2: применить политику и собрать записи ──
  const out = new Map<string, IntrospectedComponent>();
  for (const { dir, name, decl, raw } of collected) {
    const declFile = decl.getSourceFile();
    let configs = cvaCache.get(declFile.fileName);
    if (!configs) cvaCache.set(declFile.fileName, (configs = cvaConfigsOf(declFile)));
    const cva = cvaConfigFor(decl, configs);
    const destructured = destructuringDefaults(decl);

    const props: IntrospectedProp[] = [];
    const skipped: Array<{ name: string; reason: string }> = [];
    const skippedRaw: PropOrigin[] = [];

    for (const { sym, decl: propDecl, origin } of raw) {
      const propName = origin.name;
      // `__scopeMenubar` и родня — внутренняя кухня radix createContextScope, не публичный API.
      if (propName.startsWith('__')) continue;
      if (!keepProp(origin, sets)) {
        skipped.push({ name: propName, reason: skipReason(origin, sets) });
        skippedRaw.push(origin);
        continue;
      }
      const propType = checker.getTypeOfSymbolAtLocation(sym, propDecl ?? decl);
      const cvaValues = cva?.variants.get(propName);
      const enumValues = cvaValues ?? stringLiteralUnion(propType, propDecl);
      const description = ts
        .displayPartsToString(sym.getDocumentationComment(checker))
        .replace(/\s+/g, ' ')
        .trim();

      let def = destructured.get(propName);
      let defaultSource: IntrospectedProp['defaultSource'] =
        def !== undefined ? 'destructuring' : undefined;
      if (def === undefined && cva?.defaults.has(propName)) {
        def = cva.defaults.get(propName);
        defaultSource = 'cva';
      }
      if (def === undefined) {
        const fromDoc = jsdocDefault(sym);
        if (fromDoc !== undefined) {
          def = fromDoc;
          defaultSource = 'jsdoc';
        }
      }

      props.push({
        name: propName,
        jsonType: enumValues ? 'string' : jsonTypeOf(propType, checker),
        ...(enumValues ? { enum: enumValues } : {}),
        tsType: checker.typeToString(propType).replace(/\s+/g, ' '),
        ...(def !== undefined ? { default: def, defaultSource } : {}),
        optional: Boolean(sym.getFlags() & ts.SymbolFlags.Optional),
        ...(description ? { description } : {}),
        origin: packageOf(origin.declFile),
        fromCva: Boolean(cvaValues),
      });
    }

    props.sort((a, b) => a.name.localeCompare(b.name));
    skipped.sort((a, b) => a.name.localeCompare(b.name));
    out.set(name, {
      name,
      dir,
      ...(registryNameOf(declFile.fileName)
        ? { registryName: registryNameOf(declFile.fileName) }
        : {}),
      sourceFile: declFile.fileName
        .replace(/\\/g, '/')
        .replace(`${pkgRoot.replace(/\\/g, '/')}/`, ''),
      props,
      skipped,
      inherits: inheritsOf(skippedRaw, sets),
    });
  }
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const dumpAt = process.argv.indexOf('--dump');
  const result = introspectProps();
  const byDir = new Map<string, IntrospectedComponent[]>();
  for (const c of result.values()) {
    const list = byDir.get(c.dir) ?? [];
    list.push(c);
    byDir.set(c.dir, list);
  }
  const all = [...result.values()].flatMap((c) => c.props);
  const kitOwn = all.filter((p) => p.origin === 'ui-kit-src').length;
  console.log(
    `introspect-props: ${result.size} экспортов в ${byDir.size} каталогах, ${all.length} пропсов ` +
      `(свои кита: ${kitOwn}, библиотечные: ${all.length - kitOwn}); ` +
      `дефолтов: ${all.filter((p) => p.default !== undefined).length}, ` +
      `enum'ов: ${all.filter((p) => p.enum).length}, ` +
      `с описанием: ${all.filter((p) => p.description).length}`
  );

  if (dumpAt > 0) {
    const dir = process.argv[dumpAt + 1];
    mkdirSync(dir, { recursive: true });
    for (const [d, comps] of [...byDir].sort()) {
      comps.sort((a, b) => a.name.localeCompare(b.name));
      writeFileSync(
        join(dir, `${d}.json`),
        JSON.stringify(
          {
            dir: d,
            exports: comps,
            totals: { props: comps.reduce((n, c) => n + c.props.length, 0) },
          },
          null,
          2
        )
      );
    }
    const index = [...byDir]
      .map(([d, comps]) => ({
        dir: d,
        exports: comps.length,
        props: comps.reduce((n, c) => n + c.props.length, 0),
        kitOwnProps: comps.reduce(
          (n, c) => n + c.props.filter((p) => p.origin === 'ui-kit-src').length,
          0
        ),
      }))
      .sort((a, b) => b.props - a.props);
    writeFileSync(join(dir, '_index.json'), JSON.stringify(index, null, 2));
    console.log(`dump: ${byDir.size} файлов → ${dir}`);
  }
}
