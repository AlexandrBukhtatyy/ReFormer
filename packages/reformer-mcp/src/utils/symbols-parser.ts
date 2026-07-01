import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';
import { KNOWN_PACKAGES, type ReformerPackage } from './docs-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** A single public symbol extracted from a package's `src/index.ts`. */
export interface PublicSymbol {
  /** Symbol name as exported. */
  name: string;
  /** Kind of declaration. */
  kind: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'const' | 'unknown';
  /** Source-text signature, with bodies/initializers stripped. */
  signature: string;
  /** Leading description text from the JSDoc block. */
  description: string;
  /** All JSDoc tags in source order. */
  tags: SymbolTag[];
  /** Repo-relative path of the file declaring this symbol. */
  sourcePath: string;
  /** Package this symbol belongs to (e.g. "@reformer/cdk"). */
  package: string;
}

export interface SymbolTag {
  tag: string;
  name?: string;
  text: string;
}

const symbolsCache = new Map<string, PublicSymbol[]>();

/**
 * Map @reformer/<name> → directory name in monorepo packages/.
 */
function packageDirName(pkg: string): string {
  const tail = pkg.replace(/^@reformer\//, '');
  if (tail === 'core') return 'reformer';
  return `reformer-${tail}`;
}

function findPackageRoot(pkg: string): string | null {
  const dir = packageDirName(pkg);
  const candidates = [
    resolve(process.cwd(), 'node_modules', pkg),
    resolve(__dirname, '../../../', dir),
    resolve(process.cwd(), 'packages', dir),
  ];
  for (const c of candidates) {
    if (existsSync(c) && existsSync(resolve(c, 'package.json'))) return c;
  }
  return null;
}

function findEntry(pkgRoot: string): string | null {
  for (const rel of ['src/index.ts', 'src/index.tsx']) {
    const abs = resolve(pkgRoot, rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}

/**
 * Parse public symbols of a single package and return them sorted alphabetically.
 * Cached on first invocation.
 */
export function getPublicSymbols(pkg: string): PublicSymbol[] {
  const cached = symbolsCache.get(pkg);
  if (cached) return cached;

  const root = findPackageRoot(pkg);
  if (!root) {
    symbolsCache.set(pkg, []);
    return [];
  }
  const entry = findEntry(root);
  if (!entry) {
    symbolsCache.set(pkg, []);
    return [];
  }

  const collected = new Map<string, PublicSymbol>();
  const visited = new Set<string>();
  collectFromFile(entry, visited, collected, null, pkg);

  const result = [...collected.values()].sort((a, b) => a.name.localeCompare(b.name));
  symbolsCache.set(pkg, result);
  return result;
}

/**
 * Look up a single public symbol across one or all packages.
 *
 * @param symbolName - Name to find.
 * @param pkg - Package name. Pass `'*'` (default) to search every known package.
 */
export function findSymbol(symbolName: string, pkg: string = '*'): PublicSymbol | null {
  const targets = pkg === '*' ? [...KNOWN_PACKAGES] : [pkg as ReformerPackage];
  for (const target of targets) {
    for (const sym of getPublicSymbols(target)) {
      if (sym.name === symbolName) return sym;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal: AST traversal (mirrors scripts/generate-llms-txt logic)
// ---------------------------------------------------------------------------

function collectFromFile(
  filePath: string,
  visited: Set<string>,
  collected: Map<string, PublicSymbol>,
  aliasFilter: Set<string> | null,
  pkg: string
): void {
  const key = filePath + '||' + (aliasFilter ? [...aliasFilter].sort().join(',') : '*');
  if (visited.has(key)) return;
  visited.add(key);

  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf-8');
  const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);

  for (const stmt of sf.statements) {
    if (
      ts.isExportDeclaration(stmt) &&
      !stmt.exportClause &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      const target = resolveModule(filePath, stmt.moduleSpecifier.text);
      if (target) collectFromFile(target, visited, collected, aliasFilter, pkg);
      continue;
    }

    // export * as ns from './foo' — flatten namespace contents.
    if (
      ts.isExportDeclaration(stmt) &&
      stmt.exportClause &&
      ts.isNamespaceExport(stmt.exportClause) &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      const target = resolveModule(filePath, stmt.moduleSpecifier.text);
      if (target) collectFromFile(target, visited, collected, null, pkg);
      continue;
    }

    if (
      ts.isExportDeclaration(stmt) &&
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause) &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      const target = resolveModule(filePath, stmt.moduleSpecifier.text);
      if (!target) continue;
      const names = new Set<string>();
      for (const el of stmt.exportClause.elements) {
        const exposed = el.name.text;
        if (!aliasFilter || aliasFilter.has(exposed)) {
          names.add((el.propertyName ?? el.name).text);
        }
      }
      if (names.size > 0) collectFromFile(target, visited, collected, names, pkg);
      continue;
    }

    if (
      ts.isExportDeclaration(stmt) &&
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause) &&
      !stmt.moduleSpecifier
    ) {
      for (const el of stmt.exportClause.elements) {
        const exposed = el.name.text;
        if (aliasFilter && !aliasFilter.has(exposed)) continue;
        const localName = (el.propertyName ?? el.name).text;
        const decl = findLocalDeclaration(sf, localName);
        if (decl) addSymbol(collected, exposed, decl, sf, filePath, undefined, pkg);
      }
      continue;
    }

    if (hasExportModifier(stmt)) {
      const items = describeExportStatement(stmt, sf);
      for (const item of items) {
        if (aliasFilter && !aliasFilter.has(item.name)) continue;
        addSymbol(collected, item.name, item.decl, sf, filePath, item.kind, pkg);
      }
    }
  }
}

function hasExportModifier(node: ts.Node): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modifiers = (node as any).modifiers as ts.ModifierLike[] | undefined;
  return Boolean(modifiers && modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
}

function describeExportStatement(
  stmt: ts.Statement,
  _sf: ts.SourceFile
): Array<{ name: string; decl: ts.Node; kind: PublicSymbol['kind'] }> {
  if (ts.isFunctionDeclaration(stmt) && stmt.name) {
    return [{ name: stmt.name.text, decl: stmt, kind: 'function' }];
  }
  if (ts.isClassDeclaration(stmt) && stmt.name) {
    return [{ name: stmt.name.text, decl: stmt, kind: 'class' }];
  }
  if (ts.isInterfaceDeclaration(stmt)) {
    return [{ name: stmt.name.text, decl: stmt, kind: 'interface' }];
  }
  if (ts.isTypeAliasDeclaration(stmt)) {
    return [{ name: stmt.name.text, decl: stmt, kind: 'type' }];
  }
  if (ts.isEnumDeclaration(stmt)) {
    return [{ name: stmt.name.text, decl: stmt, kind: 'enum' }];
  }
  if (ts.isVariableStatement(stmt)) {
    const out: Array<{ name: string; decl: ts.Node; kind: PublicSymbol['kind'] }> = [];
    for (const d of stmt.declarationList.declarations) {
      if (ts.isIdentifier(d.name)) {
        out.push({ name: d.name.text, decl: stmt, kind: 'const' });
      }
    }
    return out;
  }
  return [];
}

function findLocalDeclaration(sf: ts.SourceFile, name: string): ts.Node | null {
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === name) return stmt;
    if (ts.isClassDeclaration(stmt) && stmt.name?.text === name) return stmt;
    if (ts.isInterfaceDeclaration(stmt) && stmt.name.text === name) return stmt;
    if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === name) return stmt;
    if (ts.isEnumDeclaration(stmt) && stmt.name.text === name) return stmt;
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === name) return stmt;
      }
    }
  }
  return null;
}

function addSymbol(
  map: Map<string, PublicSymbol>,
  name: string,
  decl: ts.Node,
  sf: ts.SourceFile,
  filePath: string,
  kind: PublicSymbol['kind'] | undefined,
  pkg: string
): void {
  const jsdoc = extractJSDoc(decl);
  const candidate: PublicSymbol = {
    name,
    kind: kind ?? guessKind(decl),
    signature: extractSignature(decl, sf),
    description: jsdoc.description,
    tags: jsdoc.tags,
    sourcePath: relative(process.cwd(), filePath).replace(/\\/g, '/'),
    package: pkg,
  };
  const existing = map.get(name);
  if (!existing || isRicher(candidate, existing)) {
    map.set(name, candidate);
  }
}

function isRicher(a: PublicSymbol, b: PublicSymbol): boolean {
  const aEx = a.tags.filter((t) => t.tag === 'example').length;
  const bEx = b.tags.filter((t) => t.tag === 'example').length;
  if (aEx !== bEx) return aEx > bEx;
  if (a.description.length !== b.description.length) {
    return a.description.length > b.description.length;
  }
  return a.tags.length > b.tags.length;
}

function guessKind(decl: ts.Node): PublicSymbol['kind'] {
  if (ts.isFunctionDeclaration(decl)) return 'function';
  if (ts.isClassDeclaration(decl)) return 'class';
  if (ts.isInterfaceDeclaration(decl)) return 'interface';
  if (ts.isTypeAliasDeclaration(decl)) return 'type';
  if (ts.isEnumDeclaration(decl)) return 'enum';
  if (ts.isVariableStatement(decl)) return 'const';
  return 'unknown';
}

function extractSignature(decl: ts.Node, sf: ts.SourceFile): string {
  let text = decl.getText(sf).trim().replace(/\s+$/, '');

  if (ts.isVariableStatement(decl)) {
    text = text
      .replace(/=\s*[\s\S]*$/, '')
      .trim()
      .replace(/[,;]?$/, '');
  }
  if (ts.isFunctionDeclaration(decl) && decl.body) {
    const bodyStart = decl.body.getStart(sf) - decl.getStart(sf);
    text = text
      .slice(0, bodyStart)
      .trim()
      .replace(/[{;,]?$/, '');
  }
  if (ts.isClassDeclaration(decl) && decl.members.length > 0) {
    const firstMember = decl.members[0];
    const offset = firstMember.getStart(sf) - decl.getStart(sf);
    text = text.slice(0, offset).trim() + ' /* … */ }';
  }
  return text;
}

function extractJSDoc(decl: ts.Node): { description: string; tags: SymbolTag[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsDocs: ts.JSDoc[] = (decl as any).jsDoc ?? [];
  if (jsDocs.length === 0) return { description: '', tags: [] };
  const block = jsDocs[jsDocs.length - 1];

  const description = (block.comment ? renderComment(block.comment) : '').trim();
  const tags = (block.tags ?? []).map((t) => ({
    tag: t.tagName.text,
    name: tagName(t),
    text: renderComment(t.comment ?? '').trim(),
  }));
  return { description, tags };
}

function tagName(tag: ts.JSDocTag): string | undefined {
  if (ts.isJSDocParameterTag(tag) && tag.name && ts.isIdentifier(tag.name)) {
    return tag.name.text;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const name = (tag as any).name;
  if (name && ts.isIdentifier(name)) return name.text;
  return undefined;
}

function renderComment(comment: string | ts.NodeArray<ts.JSDocComment>): string {
  if (typeof comment === 'string') return comment;
  if (!Array.isArray(comment)) return '';
  return comment
    .map((part) => {
      if (typeof part === 'string') return part;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = part as any;
      if (p.kind === ts.SyntaxKind.JSDocText) return p.text;
      if (p.kind === ts.SyntaxKind.JSDocLink) {
        const name = p.name ? p.name.getText() : '';
        return `{@link ${name}${p.text ?? ''}}`;
      }
      return p.text ?? '';
    })
    .join('');
}

function resolveModule(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const baseDir = dirname(fromFile);
  const candidates = [spec + '.ts', spec + '.tsx', `${spec}/index.ts`, `${spec}/index.tsx`];
  for (const rel of candidates) {
    const abs = resolve(baseDir, rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}
