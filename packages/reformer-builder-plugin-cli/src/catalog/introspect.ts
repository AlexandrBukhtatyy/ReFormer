/**
 * Интроспекция входа кита через TypeScript Compiler API: экспорты, их пропсы, статики.
 *
 * Перенесена из генератора `@reformer/ui-kit` (`scripts/introspect-props.ts`) с обобщением:
 * ui-kit обходил свои каталоги компонентов, а здесь источник — ВХОД пакета кита (`entry`), то
 * есть ровно те символы, которые импортирует кодоген и рисует превью.
 *
 * ## Откуда берётся тип пропсов
 *
 * 1. **Сигнатура** — первый параметр вызова (функция, `FC`, `forwardRef`, `memo`) или
 *    конструктора (классовый компонент).
 * 2. **Аннотация** — когда тип символа не разрешился. Так бывает в чужих `.d.ts` чаще, чем
 *    хотелось бы: `VFC` нет в `@types/react` 19, у `styled-components` 5 нет своих типов, и
 *    `Calendar: VFC<CalendarProps>` или `Skeleton: StyledComponent<(p: SkeletonProps) => …>`
 *    для компилятора — `any`. Тогда разбирается узел аннотации: `FC`/`VFC`/`FunctionComponent`/
 *    `ComponentType`/`ForwardRefExoticComponent`/`NamedExoticComponent` — первый аргумент;
 *    `MemoExoticComponent<T>` — компонент `T`; `StyledComponent<C, T, O, A>` — пропсы `C` (тег,
 *    функция или компонент) плюс `O`; пересечение — компонентная часть даёт пропсы, остальные —
 *    статики.
 * 3. **Части** — если тип пропсов целиком схлопнулся в `any` (пересечение с неразрешённым
 *    типом), пропсы собираются из разрешимых членов пересечения, а тип помечается неполным.
 *
 * Не вывелось ничего — пропсов у экспорта нет (`props: undefined`), и решать, что с ним делать,
 * будет классификация: палитровой записи без пропсов генератор откажет.
 *
 * @module @reformer/builder-plugin-cli/catalog/introspect
 */

import type * as TS from 'typescript';

import {
  compareCodePoints,
  levelOfPackage,
  packageFromPath,
  type PropLevel,
  type PropOrigin,
} from './policy.js';
import type { TypeScriptModule } from './program.js';

/** Происхождение файла объявления. */
export interface FileOrigin {
  /** npm-пакет; для исходников кита — `kit`. */
  readonly pkg: string;
  readonly level: PropLevel;
}

/** Проп как он есть в типе — до политики отбора. */
export interface RawProp {
  readonly name: string;
  readonly symbol: TS.Symbol;
  readonly declaration: TS.Declaration | undefined;
  readonly origin: PropOrigin;
}

/** Экспорт входа кита. */
export interface ExportInfo {
  readonly name: string;
  readonly declaration: TS.Declaration | undefined;
  /** Компонент: вызывается с пропсами (или распознан по аннотации). */
  readonly component: boolean;
  /** Пропсы; `undefined` — тип пропсов не выведен. */
  readonly props?: readonly RawProp[];
  /** Как выведен тип пропсов. */
  readonly via?: 'signature' | 'annotation';
  /** Тип пропсов собран из части членов пересечения: остальное не разрешилось. */
  readonly partial: boolean;
  /** PascalCase-свойства-компоненты (`Textbox.Masked` → `Masked`), без `@deprecated`. */
  readonly statics: readonly string[];
  /** Есть статика `reformerAdapter` — экспорт объявляет себя полем формы. */
  readonly fieldAdapter: boolean;
  readonly deprecated: boolean;
  /** Умолчания из деструктуризации параметра (только исходники кита). */
  readonly destructured: ReadonlyMap<string, string | number | boolean>;
}

/** Проп, разобранный до формы, близкой к JSON Schema. */
export interface PropInfo {
  readonly name: string;
  /** JSON-тип; нет — тип не выражается в JSON (функция, React-узел, сложный объект). */
  readonly jsonType?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Значения union'а строковых литералов в порядке объявления. */
  readonly enum?: readonly string[];
  /** Отображаемый TS-тип без `undefined`, без `import("…").`, ограниченной длины. */
  readonly tsType: string;
  readonly default?: string | number | boolean;
  readonly description?: string;
  readonly optional: boolean;
}

export interface IntrospectorOptions {
  /** Каталог кита (абсолютный): файлы в нём вне `node_modules` — исходники кита. */
  readonly kitDir: string;
  /** Свои пакеты дизайн-системы. */
  readonly ownPackages: ReadonlySet<string>;
  /** Чтение файлов — для имени пакета у файлов вне `node_modules` (рабочие пакеты монорепо). */
  readonly fileExists: (file: string) => boolean;
  readonly readFile: (file: string) => string | undefined;
}

/** Предел длины отображаемого TS-типа: инспектору нужна подсказка, а не простыня. */
export const MAX_TS_TYPE_LENGTH = 160;

/** Псевдонимы типов компонентов, у которых тип пропсов — первый аргумент. */
const PROPS_ARGUMENT_TYPES = new Set([
  'FC',
  'VFC',
  'FunctionComponent',
  'VoidFunctionComponent',
  'ComponentType',
  'ComponentClass',
  'ExoticComponent',
  'NamedExoticComponent',
  'ForwardRefExoticComponent',
]);

/** Обёртки компонента: первый аргумент — сам компонент. */
const WRAPPED_COMPONENT_TYPES = new Set(['MemoExoticComponent', 'LazyExoticComponent']);

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

/** Глубина разбора аннотаций: защита от циклов псевдонимов. */
const MAX_DEPTH = 8;

/** Что известно о значении: компонент ли оно и откуда его пропсы. */
interface ValueAnalysis {
  readonly component: boolean;
  readonly types?: readonly TS.Type[];
  readonly via?: 'signature' | 'annotation';
  readonly partial?: boolean;
  /** Типы, чьи PascalCase-свойства — статики компонента. */
  readonly carriers: readonly TS.Type[];
}

/** Типы пропсов, собранные из узла типа; `partial` — часть членов не разрешилась. */
interface NodeTypes {
  readonly types: readonly TS.Type[];
  readonly partial: boolean;
}

function slash(path: string): string {
  return path.replace(/\\/g, '/');
}

/** Ключ сравнения путей: на Windows регистр букв пути не значим. */
function pathKey(path: string): string {
  const normalized = slash(path).replace(/\/+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export class KitIntrospector {
  readonly checker: TS.TypeChecker;
  private readonly kitKey: string;
  private readonly origins = new Map<string, FileOrigin>();
  private readonly packageJsonNames = new Map<string, string | undefined>();
  private intrinsicCache: TS.Type | null | undefined;
  private domEventsCache: Set<string> | undefined;

  constructor(
    private readonly ts: TypeScriptModule,
    private readonly program: TS.Program,
    private readonly options: IntrospectorOptions
  ) {
    this.checker = program.getTypeChecker();
    this.kitKey = pathKey(options.kitDir);
  }

  // ── Происхождение ────────────────────────────────────────────────────────────

  /** Пакет и уровень владения файла объявления. */
  originOf(file: string): FileOrigin {
    const cached = this.origins.get(file);
    if (cached !== undefined) return cached;
    const key = pathKey(file);
    let origin: FileOrigin;
    const inKit = key.startsWith(`${this.kitKey}/`);
    const rest = inKit ? key.slice(this.kitKey.length + 1) : '';
    if (inKit && !rest.split('/').includes('node_modules')) {
      origin = { pkg: 'kit', level: 'kit' };
    } else {
      const pkg = packageFromPath(file) ?? this.nearestPackageName(file) ?? '?';
      origin = { pkg, level: levelOfPackage(pkg, this.options.ownPackages) };
    }
    this.origins.set(file, origin);
    return origin;
  }

  /** Имя ближайшего `package.json` для файла вне `node_modules` (рабочий пакет монорепо). */
  private nearestPackageName(file: string): string | undefined {
    let dir = slash(file).replace(/\/[^/]*$/, '');
    while (dir.length > 0) {
      if (this.packageJsonNames.has(dir)) return this.packageJsonNames.get(dir);
      const manifest = `${dir}/package.json`;
      if (this.options.fileExists(manifest)) {
        let name: string | undefined;
        try {
          const parsed = JSON.parse(this.options.readFile(manifest) ?? '{}') as { name?: unknown };
          name = typeof parsed.name === 'string' ? parsed.name : undefined;
        } catch {
          name = undefined;
        }
        this.packageJsonNames.set(dir, name);
        return name;
      }
      const parent = dir.replace(/\/[^/]*$/, '');
      if (parent === dir) break;
      dir = parent;
    }
    return undefined;
  }

  private levelRank(decl: TS.Declaration): number {
    const level = this.originOf(decl.getSourceFile().fileName).level;
    return level === 'kit' ? 0 : level === 'own' ? 1 : level === 'foreign' ? 2 : 3;
  }

  /**
   * Объявление, по которому судим о происхождении пропа. При пересечении
   * `HTMLAttributes & { id?: … }` первой идёт декларация `@types/react`, и собственный проп
   * библиотеки читался бы HTML-атрибутом. Приоритет — у самого «близкого» уровня владения:
   * кит, свои пакеты, чужие, инфраструктура.
   */
  private pickDeclaration(symbol: TS.Symbol): TS.Declaration | undefined {
    const decls = symbol.declarations ?? [];
    let best: TS.Declaration | undefined;
    let bestRank = Number.POSITIVE_INFINITY;
    for (const decl of decls) {
      const rank = this.levelRank(decl);
      if (rank < bestRank) {
        best = decl;
        bestRank = rank;
      }
    }
    return best;
  }

  /** Имя интерфейса/типа, в котором объявлен проп (`DOMAttributes`, `SliderProps`). */
  private ifaceOf(decl: TS.Declaration | undefined): string {
    const { ts } = this;
    let node: TS.Node | undefined = decl;
    while (node !== undefined) {
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return node.name.text;
      node = node.parent;
    }
    return '?';
  }

  private isUnresolved(type: TS.Type): boolean {
    return (type.flags & this.ts.TypeFlags.Any) !== 0;
  }

  /** Тип ничего не говорит о пропсах: `any` (в том числе неразрешённый) или `unknown`. */
  private isVague(type: TS.Type): boolean {
    return (type.flags & (this.ts.TypeFlags.Any | this.ts.TypeFlags.Unknown)) !== 0;
  }

  private isDeprecated(symbol: TS.Symbol): boolean {
    return symbol.getJsDocTags().some((tag) => tag.name === 'deprecated');
  }

  // ── Экспорты входа ───────────────────────────────────────────────────────────

  /**
   * Экспорты-значения входа кита, по кодовым точкам имени. `undefined` — вход не в программе.
   * Экспорты, чей символ не разрешился (реэкспорт из ненайденного модуля), — в `unresolved`.
   */
  exportsOf(
    entry: string
  ):
    | { readonly exports: readonly ExportInfo[]; readonly unresolved: readonly string[] }
    | undefined {
    const { ts, checker } = this;
    const sf = this.program.getSourceFile(entry);
    if (sf === undefined) return undefined;
    const moduleSymbol = checker.getSymbolAtLocation(sf);
    if (moduleSymbol === undefined) return { exports: [], unresolved: [] };
    const exports: ExportInfo[] = [];
    const unresolved: string[] = [];
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const name = exported.getName();
      if (name === 'default') continue;
      const symbol =
        (exported.flags & ts.SymbolFlags.Alias) !== 0
          ? checker.getAliasedSymbol(exported)
          : exported;
      if ((symbol.declarations ?? []).length === 0) {
        unresolved.push(name);
        continue;
      }
      if ((symbol.flags & ts.SymbolFlags.Value) === 0) continue;
      exports.push(this.analyzeExport(name, symbol));
    }
    exports.sort((a, b) => compareCodePoints(a.name, b.name));
    unresolved.sort(compareCodePoints);
    return { exports, unresolved };
  }

  private analyzeExport(name: string, symbol: TS.Symbol): ExportInfo {
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    const deprecated = this.isDeprecated(symbol);
    const base = {
      name,
      declaration,
      deprecated,
      partial: false,
      statics: [] as string[],
      fieldAdapter: false,
      destructured: new Map<string, string | number | boolean>(),
    };
    if (!PASCAL_CASE.test(name)) return { ...base, component: false };
    const analysis = this.analyzeValue(symbol, 0);
    if (!analysis.component) return { ...base, component: false };
    const { statics, fieldAdapter } = this.staticsOf(analysis.carriers);
    return {
      ...base,
      component: true,
      ...(analysis.types === undefined
        ? {}
        : { props: this.collectProps(analysis.types, declaration), via: analysis.via }),
      partial: analysis.partial === true,
      statics,
      fieldAdapter,
      destructured:
        declaration !== undefined &&
        this.originOf(declaration.getSourceFile().fileName).level === 'kit'
          ? this.destructuringDefaults(declaration)
          : base.destructured,
    };
  }

  /** Компонент ли значение символа и откуда его пропсы. */
  private analyzeValue(symbol: TS.Symbol, depth: number): ValueAnalysis {
    const { ts, checker } = this;
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (declaration === undefined || depth > MAX_DEPTH) return { component: false, carriers: [] };
    const type = checker.getTypeOfSymbol(symbol);

    if (!this.isUnresolved(type)) {
      const signature = this.componentSignature(type);
      if (signature === undefined || !this.looksLikeComponent(signature)) {
        return { component: false, carriers: [] };
      }
      // Контекст React 19 вызываем (он же Provider), но узлом формы не бывает.
      if (
        type.getProperty('Provider') !== undefined &&
        type.getProperty('Consumer') !== undefined
      ) {
        return { component: false, carriers: [] };
      }
      const param = signature.signature.getParameters()[0];
      if (param === undefined) {
        return { component: true, types: [], via: 'signature', carriers: [type] };
      }
      const propsType = checker.getTypeOfSymbol(param);
      if (!this.isVague(propsType)) {
        return { component: true, types: [propsType], via: 'signature', carriers: [type] };
      }
      // Тип пропсов размыт (`any`/`unknown`): компонент-обёртка над неразрешённым типом —
      // `MemoExoticComponent<VFC<P>>`. Сначала аннотация самого экспорта…
      const own = this.typeNodeOf(declaration);
      const fromOwn = own === undefined ? undefined : this.fromAnnotation(own, depth + 1);
      if (fromOwn !== undefined && fromOwn.types.length > 0) {
        return {
          component: true,
          types: fromOwn.types,
          via: 'annotation',
          partial: fromOwn.partial,
          carriers: [type, ...fromOwn.carriers],
        };
      }
      // …затем разрешимые части аннотации параметра, если параметр объявлен самим экспортом
      // (`function X(props: A & Missing)` — пересечение с неразрешённым схлопнулось в `any`).
      const paramDecl = param.valueDeclaration;
      const node =
        paramDecl !== undefined && ts.isParameter(paramDecl) && isInside(paramDecl, declaration)
          ? paramDecl.type
          : undefined;
      const parts = node === undefined ? undefined : this.typesFromNode(node, depth + 1);
      if (parts !== undefined) {
        return {
          component: true,
          types: parts.types,
          via: 'signature',
          partial: true,
          carriers: [type],
        };
      }
      return { component: true, carriers: [type] };
    }

    // Тип не разрешился: разбор аннотации объявления.
    const annotation = this.typeNodeOf(declaration);
    if (annotation !== undefined) {
      const fromAnnotation = this.fromAnnotation(annotation, depth + 1);
      if (fromAnnotation !== undefined) {
        return {
          component: true,
          types: fromAnnotation.types,
          via: 'annotation',
          partial: fromAnnotation.partial,
          carriers: fromAnnotation.carriers,
        };
      }
    }
    // `export const X = Y` без аннотации — смотрим на `Y`.
    if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
      const init = declaration.initializer;
      if (ts.isIdentifier(init) || ts.isPropertyAccessExpression(init)) {
        const target = checker.getSymbolAtLocation(init);
        if (target !== undefined) {
          const resolved =
            (target.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(target) : target;
          return this.analyzeValue(resolved, depth + 1);
        }
      }
    }
    // Неизвестно что с неразрешённым типом и PascalCase-именем: считаем компонентом без пропсов —
    // пусть решает классификация (в палитру такой экспорт без `propsFrom` не пустят).
    return { component: true, carriers: [] };
  }

  /** Первая сигнатура вызова или конструктора (у объединения — первого члена, где она есть). */
  private componentSignature(
    type: TS.Type
  ): { readonly signature: TS.Signature; readonly construct: boolean } | undefined {
    const members = type.isUnion() ? type.types : [type];
    for (const member of members) {
      const call = member.getCallSignatures()[0];
      if (call !== undefined) return { signature: call, construct: false };
      const construct = member.getConstructSignatures()[0];
      if (construct !== undefined) return { signature: construct, construct: true };
    }
    return undefined;
  }

  private isPrimitiveLike(type: TS.Type): boolean {
    const { TypeFlags } = this.ts;
    if (this.isUnresolved(type)) return false;
    if (type.isUnion()) return type.types.every((member) => this.isPrimitiveLike(member));
    const primitive =
      TypeFlags.StringLike |
      TypeFlags.NumberLike |
      TypeFlags.BooleanLike |
      TypeFlags.BigIntLike |
      TypeFlags.ESSymbolLike |
      TypeFlags.VoidLike |
      TypeFlags.Null |
      TypeFlags.Never;
    return (type.flags & primitive) !== 0;
  }

  /**
   * Похожа ли сигнатура на компонент: классу нужен `render` у экземпляра, функции — не
   * примитивный результат, не примитивный первый параметр и не больше двух параметров
   * (пропсы и `ref`/контекст). Отсекает PascalCase-помощники и классы ошибок.
   */
  private looksLikeComponent(found: {
    readonly signature: TS.Signature;
    readonly construct: boolean;
  }): boolean {
    const { signature, construct } = found;
    const result = signature.getReturnType();
    if (construct) return this.isUnresolved(result) || result.getProperty('render') !== undefined;
    if (this.isPrimitiveLike(result)) return false;
    // Возвращает функцию — компонент высшего порядка (`withX(Component)`), а не компонент.
    if (!this.isUnresolved(result) && result.getCallSignatures().length > 0) return false;
    const params = signature.getParameters();
    if (params.length > 2) return false;
    const first = params[0];
    return first === undefined || !this.isPrimitiveLike(this.checker.getTypeOfSymbol(first));
  }

  /** Узел аннотации типа у объявления значения или свойства. */
  private typeNodeOf(decl: TS.Declaration): TS.TypeNode | undefined {
    const { ts } = this;
    if (
      ts.isVariableDeclaration(decl) ||
      ts.isPropertySignature(decl) ||
      ts.isPropertyDeclaration(decl) ||
      ts.isParameter(decl)
    ) {
      return decl.type;
    }
    return undefined;
  }

  /** Имя и аргументы ссылки на тип: `React.VFC<P>`, `import("x").StyledComponent<…>`. */
  private referenceOf(
    node: TS.TypeNode
  ): { readonly name: string; readonly args: readonly TS.TypeNode[] } | undefined {
    const { ts } = this;
    const rightmost = (name: TS.EntityName): string =>
      ts.isIdentifier(name) ? name.text : name.right.text;
    if (ts.isTypeReferenceNode(node)) {
      return { name: rightmost(node.typeName), args: node.typeArguments ?? [] };
    }
    if (ts.isImportTypeNode(node) && node.qualifier !== undefined) {
      return { name: rightmost(node.qualifier), args: node.typeArguments ?? [] };
    }
    return undefined;
  }

  /**
   * Типы пропсов из узла типа: сам тип, если он разрешается, иначе — разрешимые члены
   * пересечения и тело псевдонима (пересечение с неразрешённым членом схлопывается в `any`).
   */
  private typesFromNode(node: TS.TypeNode, depth: number): NodeTypes | undefined {
    const { ts, checker } = this;
    if (depth > MAX_DEPTH) return undefined;
    const type = checker.getTypeFromTypeNode(node);
    if (!this.isUnresolved(type)) return { types: [type], partial: false };
    if (ts.isParenthesizedTypeNode(node)) return this.typesFromNode(node.type, depth + 1);
    if (ts.isIntersectionTypeNode(node)) {
      const types: TS.Type[] = [];
      for (const member of node.types) {
        const inner = this.typesFromNode(member, depth + 1);
        if (inner !== undefined) types.push(...inner.types);
      }
      return types.length > 0 ? { types, partial: true } : undefined;
    }
    if (ts.isTypeReferenceNode(node)) {
      const target = checker.getSymbolAtLocation(node.typeName);
      const symbol =
        target !== undefined && (target.flags & ts.SymbolFlags.Alias) !== 0
          ? checker.getAliasedSymbol(target)
          : target;
      for (const decl of symbol?.declarations ?? []) {
        if (ts.isTypeAliasDeclaration(decl)) {
          const inner = this.typesFromNode(decl.type, depth + 1);
          if (inner !== undefined) return { types: inner.types, partial: true };
        }
      }
    }
    return undefined;
  }

  /** Разбор аннотации компонента: откуда пропсы и какие типы несут статики. */
  private fromAnnotation(
    node: TS.TypeNode,
    depth: number
  ): (NodeTypes & { readonly carriers: readonly TS.Type[] }) | undefined {
    const { ts, checker } = this;
    if (depth > MAX_DEPTH) return undefined;
    if (ts.isParenthesizedTypeNode(node)) return this.fromAnnotation(node.type, depth + 1);

    if (ts.isIntersectionTypeNode(node)) {
      let found: (NodeTypes & { readonly carriers: readonly TS.Type[] }) | undefined;
      const carriers: TS.Type[] = [];
      for (const member of node.types) {
        const inner = found === undefined ? this.fromAnnotation(member, depth + 1) : undefined;
        if (inner !== undefined) {
          found = inner;
          continue;
        }
        const memberType = checker.getTypeFromTypeNode(member);
        if (!this.isUnresolved(memberType)) carriers.push(memberType);
      }
      return found === undefined
        ? undefined
        : {
            types: found.types,
            partial: found.partial,
            carriers: [...found.carriers, ...carriers],
          };
    }
    if (ts.isUnionTypeNode(node)) {
      for (const member of node.types) {
        const inner = this.fromAnnotation(member, depth + 1);
        if (inner !== undefined) return inner;
      }
      return undefined;
    }
    if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) {
      const param = node.parameters[0];
      if (param === undefined) return { types: [], partial: false, carriers: [] };
      if (param.type === undefined) return undefined;
      const inner = this.typesFromNode(param.type, depth + 1);
      return inner === undefined ? undefined : { ...inner, carriers: [] };
    }

    const reference = this.referenceOf(node);
    if (reference !== undefined) {
      const [first, , third] = reference.args;
      if (PROPS_ARGUMENT_TYPES.has(reference.name)) {
        if (first === undefined) return { types: [], partial: false, carriers: [] };
        const inner = this.typesFromNode(first, depth + 1);
        return inner === undefined ? undefined : { ...inner, carriers: [] };
      }
      if (WRAPPED_COMPONENT_TYPES.has(reference.name)) {
        return first === undefined ? undefined : this.componentArgument(first, depth + 1);
      }
      if (reference.name === 'StyledComponent') {
        // StyledComponent<C, T, O, A>: пропсы C (тег, функция, компонент) плюс добавочные O.
        const base = first === undefined ? undefined : this.componentArgument(first, depth + 1);
        const extra = third === undefined ? undefined : this.typesFromNode(third, depth + 1);
        if (base === undefined && extra === undefined) return undefined;
        return {
          types: [...(base?.types ?? []), ...(extra?.types ?? [])],
          partial: base?.partial === true || extra?.partial === true,
          carriers: base?.carriers ?? [],
        };
      }
    }

    // Иначе — тип узла разрешается и вызывается (свой псевдоним компонента).
    const resolved = checker.getTypeFromTypeNode(node);
    if (!this.isUnresolved(resolved)) {
      const signature = this.componentSignature(resolved);
      if (signature !== undefined && this.looksLikeComponent(signature)) {
        const param = signature.signature.getParameters()[0];
        return {
          types: param === undefined ? [] : [checker.getTypeOfSymbol(param)],
          partial: false,
          carriers: [resolved],
        };
      }
    }
    return undefined;
  }

  /** `C` из `StyledComponent<C, …>`, `T` из `MemoExoticComponent<T>`: тег, функция или компонент. */
  private componentArgument(
    node: TS.TypeNode,
    depth: number
  ): (NodeTypes & { readonly carriers: readonly TS.Type[] }) | undefined {
    const { ts, checker } = this;
    if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) {
      const intrinsic = this.intrinsicProps(node.literal.text);
      return { types: intrinsic === undefined ? [] : [intrinsic], partial: false, carriers: [] };
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) return undefined;
    if (ts.isTypeQueryNode(node)) {
      const target = checker.getSymbolAtLocation(node.exprName);
      if (target === undefined) return undefined;
      const symbol =
        (target.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(target) : target;
      const analysis = this.analyzeValue(symbol, depth + 1);
      return analysis.types === undefined
        ? undefined
        : {
            types: analysis.types,
            partial: analysis.partial === true,
            carriers: analysis.carriers,
          };
    }
    return this.fromAnnotation(node, depth);
  }

  /**
   * Пропсы встроенного тега (`'div'`) — `React.JSX.IntrinsicElements[tag]` из `@types/react`.
   * Нужны `StyledComponent<'div', …>`: всё это HTML-атрибуты, и в каталог они уйдут маркером
   * `x-inherits.react`, но `className` останется.
   */
  private intrinsicProps(tag: string): TS.Type | undefined {
    const elements = this.intrinsicElements();
    const property = elements?.getProperty(tag);
    return property === undefined ? undefined : this.checker.getTypeOfSymbol(property);
  }

  private intrinsicElements(): TS.Type | undefined {
    if (this.intrinsicCache !== undefined) return this.intrinsicCache ?? undefined;
    const { checker } = this;
    this.intrinsicCache = null;
    for (const sf of this.program.getSourceFiles()) {
      if (this.originOf(sf.fileName).pkg !== '@types/react') continue;
      const moduleSymbol = checker.getSymbolAtLocation(sf);
      if (moduleSymbol === undefined) continue;
      const jsx = checker.getExportsOfModule(moduleSymbol).find((s) => s.getName() === 'JSX');
      if (jsx === undefined) continue;
      const elements = checker
        .getExportsOfModule(jsx)
        .find((s) => s.getName() === 'IntrinsicElements');
      if (elements === undefined) continue;
      this.intrinsicCache = checker.getDeclaredTypeOfSymbol(elements);
      break;
    }
    return this.intrinsicCache ?? undefined;
  }

  /** Статики (PascalCase-свойства-компоненты) и признак поля (`reformerAdapter`). */
  private staticsOf(carriers: readonly TS.Type[]): {
    readonly statics: string[];
    readonly fieldAdapter: boolean;
  } {
    const { checker } = this;
    const statics = new Set<string>();
    let fieldAdapter = false;
    for (const carrier of carriers) {
      for (const property of checker.getPropertiesOfType(carrier)) {
        const name = property.getName();
        if (name === 'reformerAdapter') fieldAdapter = true;
        if (!PASCAL_CASE.test(name) || this.isDeprecated(property)) continue;
        if (this.analyzeValue(property, 1).component) statics.add(name);
      }
    }
    return { statics: [...statics].sort(compareCodePoints), fieldAdapter };
  }

  // ── Пропсы ───────────────────────────────────────────────────────────────────

  /**
   * Все пропсы типов, включая ветви дискриминированного union'а: `getProperties()` на union'е
   * отдаёт только ОБЩИЕ свойства, и ветвевые (`Calendar.selected` в ветке `mode: 'single'`)
   * выпадали бы молча. Первое объявление имени выигрывает. По кодовым точкам имени.
   */
  private collectProps(types: readonly TS.Type[], fallback: TS.Declaration | undefined): RawProp[] {
    const byName = new Map<string, RawProp>();
    for (const type of types) {
      for (const symbol of this.allProperties(type)) {
        const name = symbol.getName();
        if (byName.has(name)) continue;
        const declaration = this.pickDeclaration(symbol);
        const file = (declaration ?? fallback)?.getSourceFile().fileName ?? '';
        const { pkg, level } = this.originOf(file);
        byName.set(name, {
          name,
          symbol,
          declaration,
          origin: {
            name,
            pkg,
            level,
            iface: this.ifaceOf(declaration),
            deprecated: this.isDeprecated(symbol),
          },
        });
      }
    }
    return [...byName.values()].sort((a, b) => compareCodePoints(a.name, b.name));
  }

  private allProperties(type: TS.Type): TS.Symbol[] {
    const common = this.checker.getPropertiesOfType(type);
    if (!type.isUnion()) return common;
    const merged = new Map(common.map((p) => [p.getName(), p]));
    for (const branch of type.types) {
      for (const p of this.checker.getPropertiesOfType(branch)) {
        if (!merged.has(p.getName())) merged.set(p.getName(), p);
      }
    }
    return [...merged.values()];
  }

  /**
   * Имена DOM-событий — члены `DOMAttributes` из `@types/react`, собранные из самих типов
   * (а не захардкоженным списком): `onClick` уходит, `onOpenChange` остаётся.
   */
  domEvents(): ReadonlySet<string> {
    if (this.domEventsCache !== undefined) return this.domEventsCache;
    const { ts } = this;
    const out = new Set<string>();
    for (const sf of this.program.getSourceFiles()) {
      if (this.originOf(sf.fileName).pkg !== '@types/react') continue;
      const visit = (node: TS.Node): void => {
        if (ts.isInterfaceDeclaration(node) && node.name.text === 'DOMAttributes') {
          // Только обработчики: `children`/`dangerouslySetInnerHTML` объявлены там же, но это
          // не события (их отсекает правило структурных пропсов).
          for (const member of node.members) {
            if (
              member.name !== undefined &&
              ts.isIdentifier(member.name) &&
              /^on[A-Z]/.test(member.name.text)
            ) {
              out.add(member.name.text);
            }
          }
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    this.domEventsCache = out;
    return out;
  }

  /** Проп → JSON-тип, enum в порядке объявления, отображаемый тип, умолчание, описание. */
  describe(prop: RawProp, owner: ExportInfo): PropInfo {
    const { ts, checker } = this;
    const type = checker.getTypeOfSymbol(prop.symbol);
    const enumValues = this.stringLiteralUnion(type, prop.declaration);
    const description = ts
      .displayPartsToString(prop.symbol.getDocumentationComment(checker))
      .replace(/\s+/g, ' ')
      .trim();
    const fallbackDefault = owner.destructured.get(prop.name);
    const def = this.jsdocDefault(prop.symbol) ?? fallbackDefault;
    const jsonType = enumValues !== undefined ? 'string' : this.jsonTypeOf(type);
    return {
      name: prop.name,
      ...(jsonType === undefined ? {} : { jsonType }),
      ...(enumValues === undefined ? {} : { enum: enumValues }),
      tsType:
        enumValues !== undefined
          ? truncateType(enumValues.map((value) => `'${value}'`).join(' | '))
          : displayType(
              checker.typeToString(
                type,
                undefined,
                ts.TypeFormatFlags.NoTruncation |
                  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
              )
            ),
      ...(def === undefined ? {} : { default: def }),
      ...(description === '' ? {} : { description }),
      optional: (prop.symbol.flags & ts.SymbolFlags.Optional) !== 0,
    };
  }

  /**
   * Значения union'а строковых литералов В ПОРЯДКЕ ОБЪЯВЛЕНИЯ. Порядок `type.types` — порядок
   * компилятора, а enum задаёт порядок опций в селекте инспектора, поэтому порядок читается из
   * узла типа объявления (с переходом по псевдониму); состав — из типа.
   */
  private stringLiteralUnion(
    type: TS.Type,
    decl: TS.Declaration | undefined
  ): readonly string[] | undefined {
    const { TypeFlags } = this.ts;
    const parts = type.isUnion() ? type.types : [type];
    const values: string[] = [];
    for (const part of parts) {
      if ((part.flags & (TypeFlags.Undefined | TypeFlags.Null)) !== 0) continue;
      if (!part.isStringLiteral()) return undefined;
      values.push(part.value);
    }
    if (values.length === 0) return undefined;
    const declared = this.declaredUnionOrder(decl);
    if (declared === undefined) return values;
    const ordered = declared.filter((value) => values.includes(value));
    return ordered.length === values.length ? ordered : values;
  }

  private declaredUnionOrder(decl: TS.Declaration | undefined): string[] | undefined {
    const { ts } = this;
    if (decl === undefined || !ts.isPropertySignature(decl) || decl.type === undefined) {
      return undefined;
    }
    return this.unionOrderOfNode(decl.type, 0);
  }

  private unionOrderOfNode(node: TS.TypeNode, depth: number): string[] | undefined {
    const { ts, checker } = this;
    if (depth > MAX_DEPTH) return undefined;
    if (ts.isParenthesizedTypeNode(node)) return this.unionOrderOfNode(node.type, depth + 1);
    if (ts.isTypeReferenceNode(node)) {
      const target = checker.getSymbolAtLocation(node.typeName);
      const symbol =
        target !== undefined && (target.flags & ts.SymbolFlags.Alias) !== 0
          ? checker.getAliasedSymbol(target)
          : target;
      const alias = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
      return alias === undefined ? undefined : this.unionOrderOfNode(alias.type, depth + 1);
    }
    const members = ts.isUnionTypeNode(node) ? node.types : [node];
    const out: string[] = [];
    for (const member of members) {
      if (
        member.kind === ts.SyntaxKind.UndefinedKeyword ||
        (ts.isLiteralTypeNode(member) && member.literal.kind === ts.SyntaxKind.NullKeyword)
      ) {
        continue;
      }
      if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) {
        out.push(member.literal.text);
        continue;
      }
      // Член-псевдоним union'а литералов (`Size | 'flex'`) — разворачиваем.
      const nested = ts.isTypeReferenceNode(member)
        ? this.unionOrderOfNode(member, depth + 1)
        : undefined;
      if (nested === undefined) return undefined;
      out.push(...nested);
    }
    return out.length > 0 ? out : undefined;
  }

  /** TS-тип → JSON-тип; функции и смешанные union'ы — без JSON-типа. */
  private jsonTypeOf(type: TS.Type): PropInfo['jsonType'] {
    const { TypeFlags } = this.ts;
    const parts = (type.isUnion() ? type.types : [type]).filter(
      (t) => (t.flags & (TypeFlags.Undefined | TypeFlags.Null)) === 0
    );
    if (parts.length === 0) return undefined;
    const kinds = new Set(
      parts.map((t) => {
        const flags = t.flags;
        if ((flags & TypeFlags.Any) !== 0) return 'other';
        if ((flags & (TypeFlags.String | TypeFlags.StringLiteral)) !== 0) return 'string';
        if ((flags & (TypeFlags.Number | TypeFlags.NumberLiteral)) !== 0) return 'number';
        if ((flags & (TypeFlags.Boolean | TypeFlags.BooleanLiteral)) !== 0) return 'boolean';
        if (this.checker.isArrayType(t) || this.checker.isTupleType(t)) return 'array';
        if (t.getCallSignatures().length > 0) return 'fn';
        if ((flags & TypeFlags.Object) !== 0) return 'object';
        return 'other';
      })
    );
    if (kinds.size !== 1) return undefined;
    const [only] = [...kinds];
    return only === 'fn' || only === 'other' ? undefined : (only as PropInfo['jsonType']);
  }

  /** Значение JSDoc-тега `@defaultValue` / `@default`, если библиотека его проставила. */
  private jsdocDefault(symbol: TS.Symbol): string | number | boolean | undefined {
    for (const tag of symbol.getJsDocTags()) {
      if (tag.name !== 'defaultValue' && tag.name !== 'default') continue;
      const raw = this.ts.displayPartsToString(tag.text).trim().replace(/^`|`$/g, '');
      if (raw === '') continue;
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
      return raw.replace(/^['"]|['"]$/g, '');
    }
    return undefined;
  }

  /** Развернуть `forwardRef(fn)` / `memo(fn)` до самой функции компонента. */
  private unwrapComponentFunction(node: TS.Node): TS.SignatureDeclaration | undefined {
    const { ts } = this;
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      return node;
    }
    if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
      return this.unwrapComponentFunction(node.initializer);
    }
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const [first] = node.arguments;
      return first === undefined ? undefined : this.unwrapComponentFunction(first);
    }
    return undefined;
  }

  /** Умолчания из деструктуризации параметра: `function Button({ size = 'm' })`. */
  private destructuringDefaults(decl: TS.Declaration): Map<string, string | number | boolean> {
    const { ts } = this;
    const out = new Map<string, string | number | boolean>();
    const param = this.unwrapComponentFunction(decl)?.parameters[0];
    if (param === undefined || !ts.isObjectBindingPattern(param.name)) return out;
    for (const element of param.name.elements) {
      if (element.initializer === undefined) continue;
      const keyNode = element.propertyName ?? element.name;
      if (!ts.isIdentifier(keyNode) && !ts.isStringLiteral(keyNode)) continue;
      const value = literalValue(ts, element.initializer);
      if (value !== undefined) out.set(keyNode.text, value);
    }
    return out;
  }
}

/** Лежит ли узел внутри другого (по цепочке родителей). */
function isInside(node: TS.Node, container: TS.Node): boolean {
  for (let current: TS.Node | undefined = node; current !== undefined; current = current.parent) {
    if (current === container) return true;
  }
  return false;
}

/** Литерал инициализатора → значение (с унарным минусом: `offset = -4`). */
function literalValue(
  ts: TypeScriptModule,
  node: TS.Expression
): string | number | boolean | undefined {
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

/**
 * Делит текст типа по `|` верхнего уровня — вне скобок, угловых скобок и строк. Нужен, чтобы
 * снять `undefined`, не разрезав сигнатуру `(a: string | number) => void`.
 */
export function splitTopLevelUnion(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote !== undefined) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '(' || ch === '[' || ch === '{' || ch === '<') depth++;
    else if (ch === ')' || ch === ']' || ch === '}' || ch === '>') {
      // `=>` — не закрывающая угловая скобка.
      if (!(ch === '>' && text[i - 1] === '=')) depth--;
    } else if (ch === '|' && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter((part) => part !== '');
}

/** Ограничение длины отображаемого типа. */
export function truncateType(text: string): string {
  return text.length <= MAX_TS_TYPE_LENGTH ? text : `${text.slice(0, MAX_TS_TYPE_LENGTH - 1)}…`;
}

/**
 * Отображаемый тип: без `import("…").` (абсолютные пути машины и пакеты — шум, разный на
 * разных машинах), без `undefined` в union'е верхнего уровня, в одну строку, ограниченной длины.
 */
export function displayType(raw: string): string {
  const clean = raw
    .replace(/import\("[^"]*"\)\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = splitTopLevelUnion(clean).filter((part) => part !== 'undefined');
  if (parts.length === 0) return truncateType(clean);
  // Одна оставшаяся ветвь печаталась в скобках ради соседства с `undefined`: `(() => void)`.
  return truncateType(parts.length === 1 ? unwrapParens(parts[0] ?? '') : parts.join(' | '));
}

/** Снимает внешние скобки, если они охватывают весь текст: `(() => void)` → `() => void`. */
function unwrapParens(text: string): string {
  let current = text;
  while (current.startsWith('(') && current.endsWith(')')) {
    let depth = 0;
    let closesAtEnd = true;
    for (let i = 0; i < current.length; i++) {
      const ch = current[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0 && i < current.length - 1) {
          closesAtEnd = false;
          break;
        }
      }
    }
    if (!closesAtEnd) break;
    current = current.slice(1, -1).trim();
  }
  return current;
}
