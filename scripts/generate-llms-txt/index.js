#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((a) => a.startsWith('--')));
const positional = rawArgs.filter((a) => !a.startsWith('--'));

if (positional.length !== 1 || flags.has('--help') || flags.has('-h')) {
  console.error(
    'Usage: node scripts/generate-llms-txt <package-path> [--audit]\n' +
      '  --audit  Do not write llms.txt; print public symbols missing JSDoc/@example.'
  );
  process.exit(positional.length === 0 ? 1 : 0);
}

const pkgPath = path.resolve(positional[0]);

if (!fs.existsSync(pkgPath) || !fs.statSync(pkgPath).isDirectory()) {
  console.error(`Error: ${pkgPath} is not a directory.`);
  process.exit(1);
}

if (flags.has('--audit')) {
  audit(pkgPath);
} else {
  main(pkgPath);
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

function main(pkg) {
  const meta = loadPackageMeta(pkg);
  const docs = parseDocsFiles(pkg);
  const symbols = parsePublicSymbols(pkg);

  const output = renderLlmsTxt({ meta, docs, symbols });
  const outPath = path.join(pkg, 'llms.txt');
  fs.writeFileSync(outPath, output, 'utf8');

  console.log(
    `Generated ${path.relative(process.cwd(), outPath)} ` +
      `(${docs.length} doc files, ${symbols.length} public symbols)`
  );
}

function audit(pkg) {
  const meta = loadPackageMeta(pkg);
  const symbols = parsePublicSymbols(pkg);
  const strict = flags.has('--strict');

  // Callable symbols: example is required by convention.
  const callable = (s) => s.kind === 'function' || s.kind === 'class' || s.kind === 'const';

  const noDescription = symbols.filter((s) => !s.description);
  const noExample = symbols
    .filter((s) => !s.tags.some((t) => t.tag === 'example'))
    .filter((s) => strict || callable(s));

  console.log(`Audit: ${meta.name} (${symbols.length} public symbols)`);
  console.log(`  Missing description:        ${noDescription.length}`);
  console.log(
    `  Missing @example${strict ? ' (strict)' : ' (callable only)'}: ${noExample.length}`
  );
  if (noDescription.length > 0) {
    console.log('\n  No description:');
    for (const s of noDescription) console.log(`    - ${s.kind} ${s.name}`);
  }
  if (noExample.length > 0) {
    console.log('\n  No @example:');
    for (const s of noExample) console.log(`    - ${s.kind} ${s.name}`);
  }
}

// ---------------------------------------------------------------------------
// Package metadata
// ---------------------------------------------------------------------------

function loadPackageMeta(pkg) {
  const pkgJsonPath = path.join(pkg, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    throw new Error(`No package.json at ${pkgJsonPath}`);
  }
  const json = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  return {
    name: json.name ?? path.basename(pkg),
    version: json.version ?? '0.0.0',
    description: json.description ?? '',
    displayName: humanizeName(json.name ?? path.basename(pkg)),
  };
}

function humanizeName(name) {
  // @reformer/cdk → ReFormer CDK ; @reformer/core → ReFormer Core
  const tail = name.replace(/^@reformer\//, '');
  if (!tail || tail === name) return name;
  if (tail === 'core' || tail === 'cdk') {
    return `ReFormer ${tail.toUpperCase()}`;
  }
  return `ReFormer ${tail
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')}`;
}

// ---------------------------------------------------------------------------
// docs/llms/*.md parsing
// ---------------------------------------------------------------------------

function parseDocsFiles(pkg) {
  const docsDir = path.join(pkg, 'docs', 'llms');
  if (!fs.existsSync(docsDir)) return [];

  const files = fs
    .readdirSync(docsDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  return files.map((file) => {
    const filePath = path.join(docsDir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    return {
      file,
      title: extractH1(raw) ?? stripExtension(file),
      sections: extractH2Sections(raw),
      raw,
    };
  });
}

function extractH1(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function stripExtension(name) {
  return name.replace(/\.md$/, '').replace(/^\d+-/, '');
}

/**
 * Split markdown into sections by `## ` headings.
 * Returns [{ heading, body }] preserving order.
 */
function extractH2Sections(md) {
  const lines = md.split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[1].trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) sections.push(current);
  return sections.map((s) => ({
    heading: s.heading,
    body: s.body.join('\n').trim(),
  }));
}

// ---------------------------------------------------------------------------
// Public symbols parsing (TypeScript Compiler API)
// ---------------------------------------------------------------------------

function parsePublicSymbols(pkg) {
  const entry = findEntry(pkg);
  if (!entry) return [];

  const visited = new Set();
  const collected = new Map(); // name → SymbolDoc

  collectFromFile(entry, visited, collected, null);

  // Sort alphabetically by name for deterministic output.
  return [...collected.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function findEntry(pkg) {
  const candidates = [path.join(pkg, 'src', 'index.ts'), path.join(pkg, 'src', 'index.tsx')];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * @typedef {object} SymbolDoc
 * @property {string} name
 * @property {string} kind        e.g. 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum'
 * @property {string} signature   Source text of the declaration (trimmed)
 * @property {string} description Leading description from JSDoc
 * @property {Array<{tag: string, name?: string, text: string}>} tags
 * @property {string} sourcePath  Repo-relative path to the file
 */

/**
 * Recursively collect public symbols. `aliasFilter` — set of names to keep when
 * processing `export { A, B } from './foo'`; null means keep all.
 */
function collectFromFile(filePath, visited, collected, aliasFilter) {
  const key = filePath + '||' + (aliasFilter ? [...aliasFilter].sort().join(',') : '*');
  if (visited.has(key)) return;
  visited.add(key);

  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);

  for (const stmt of sf.statements) {
    // export * from './foo'
    if (
      ts.isExportDeclaration(stmt) &&
      !stmt.exportClause &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      const target = resolveModule(filePath, stmt.moduleSpecifier.text);
      if (target) collectFromFile(target, visited, collected, aliasFilter);
      continue;
    }

    // export * as ns from './foo' — flatten namespace contents into the public set
    if (
      ts.isExportDeclaration(stmt) &&
      stmt.exportClause &&
      ts.isNamespaceExport(stmt.exportClause) &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      const target = resolveModule(filePath, stmt.moduleSpecifier.text);
      if (target) collectFromFile(target, visited, collected, null);
      continue;
    }

    // export { A, B } from './foo'
    if (
      ts.isExportDeclaration(stmt) &&
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause) &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      const target = resolveModule(filePath, stmt.moduleSpecifier.text);
      if (!target) continue;
      const names = new Set();
      for (const el of stmt.exportClause.elements) {
        const exposed = el.name.text;
        if (!aliasFilter || aliasFilter.has(exposed)) {
          // propertyName is the original name in the source module
          names.add((el.propertyName ?? el.name).text);
        }
      }
      if (names.size > 0) collectFromFile(target, visited, collected, names);
      continue;
    }

    // export { A, B }  (re-export of in-file names) — locally declared symbols
    // are already handled via direct export modifier; skip non-source-of-truth.
    if (
      ts.isExportDeclaration(stmt) &&
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause) &&
      !stmt.moduleSpecifier
    ) {
      // Local re-exports — symbols are declared in the same file with non-export modifiers.
      // Capture them as exports.
      for (const el of stmt.exportClause.elements) {
        const exposed = el.name.text;
        if (aliasFilter && !aliasFilter.has(exposed)) continue;
        const localName = (el.propertyName ?? el.name).text;
        const decl = findLocalDeclaration(sf, localName);
        if (decl) addSymbol(collected, exposed, decl, sf, filePath);
      }
      continue;
    }

    // Direct exports: export const|function|class|interface|type|enum
    if (hasExportModifier(stmt)) {
      const items = describeExportStatement(stmt, sf);
      for (const item of items) {
        if (aliasFilter && !aliasFilter.has(item.name)) continue;
        addSymbol(collected, item.name, item.decl, sf, filePath, item.kind);
      }
    }
  }
}

function hasExportModifier(node) {
  return Boolean(
    node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function describeExportStatement(stmt, _sf) {
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
    return stmt.declarationList.declarations
      .filter((d) => ts.isIdentifier(d.name))
      .map((d) => ({ name: d.name.text, decl: stmt, kind: 'const' }));
  }
  return [];
}

function findLocalDeclaration(sf, name) {
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

function addSymbol(map, name, decl, sf, filePath, kind) {
  const jsdoc = extractJSDoc(decl);
  const candidate = {
    name,
    kind: kind ?? guessKind(decl),
    signature: extractSignature(decl, sf),
    description: jsdoc.description,
    tags: jsdoc.tags,
    sourcePath: filePath,
  };
  const existing = map.get(name);
  if (!existing || isRicher(candidate, existing)) {
    map.set(name, candidate);
  }
}

/**
 * Pick the "richer" declaration when overloads collide. Priority:
 * 1. Has any @example > none.
 * 2. Longer description.
 * 3. More JSDoc tags overall.
 */
function isRicher(a, b) {
  const aEx = a.tags.filter((t) => t.tag === 'example').length;
  const bEx = b.tags.filter((t) => t.tag === 'example').length;
  if (aEx !== bEx) return aEx > bEx;
  if (a.description.length !== b.description.length) {
    return a.description.length > b.description.length;
  }
  return a.tags.length > b.tags.length;
}

function guessKind(decl) {
  if (ts.isFunctionDeclaration(decl)) return 'function';
  if (ts.isClassDeclaration(decl)) return 'class';
  if (ts.isInterfaceDeclaration(decl)) return 'interface';
  if (ts.isTypeAliasDeclaration(decl)) return 'type';
  if (ts.isEnumDeclaration(decl)) return 'enum';
  if (ts.isVariableStatement(decl)) return 'const';
  return 'unknown';
}

/**
 * Extract the source signature: just the declaration text without the JSDoc
 * preamble. For variable statements with initializers we strip the initializer
 * to keep the signature short.
 */
function extractSignature(decl, sf) {
  let text = decl.getText(sf).trim();
  // Drop trailing semicolon noise.
  text = text.replace(/\s+$/, '');

  if (ts.isVariableStatement(decl)) {
    // export const foo = …  →  export const foo: <type>
    text = text
      .replace(/=\s*[\s\S]*$/, '')
      .trim()
      .replace(/[,;]?$/, '');
  }
  if (ts.isFunctionDeclaration(decl) && decl.body) {
    // Drop function body for readability.
    const bodyStart = decl.body.getStart(sf) - decl.getStart(sf);
    text = text
      .slice(0, bodyStart)
      .trim()
      .replace(/[{;,]?$/, '');
  }
  if (ts.isClassDeclaration(decl) && decl.members.length > 0) {
    const firstMember = decl.members[0];
    const offset = firstMember.getStart(sf) - decl.getStart(sf);
    // Keep `export class Foo extends Bar { … }` shell.
    text = text.slice(0, offset).trim() + ' /* … */ }';
  }
  return text;
}

/**
 * Extract JSDoc from a declaration. Returns { description, tags }.
 */
function extractJSDoc(decl) {
  const jsDocs = decl.jsDoc ?? [];
  if (jsDocs.length === 0) return { description: '', tags: [] };
  const block = jsDocs[jsDocs.length - 1]; // the immediately-preceding block

  const description = (block.comment ? renderComment(block.comment) : '').trim();
  const tags = (block.tags ?? []).map((t) => ({
    tag: t.tagName.text,
    name: tagName(t),
    text: renderComment(t.comment ?? '').trim(),
  }));
  return { description, tags };
}

function tagName(tag) {
  if (ts.isJSDocParameterTag(tag) && tag.name && ts.isIdentifier(tag.name)) {
    return tag.name.text;
  }
  if (ts.isJSDocTypedefTag(tag) || ts.isJSDocCallbackTag(tag)) {
    if (tag.name && ts.isIdentifier(tag.name)) return tag.name.text;
  }
  if (tag.name && ts.isIdentifier(tag.name)) return tag.name.text;
  return undefined;
}

function renderComment(comment) {
  if (typeof comment === 'string') return comment;
  if (!Array.isArray(comment)) return '';
  return comment
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part.kind === ts.SyntaxKind.JSDocText) return part.text;
      if (part.kind === ts.SyntaxKind.JSDocLink) {
        const name = part.name ? part.name.getText() : '';
        return `{@link ${name}${part.text ?? ''}}`;
      }
      return part.text ?? '';
    })
    .join('');
}

/**
 * Markdown inside JSDoc descriptions/examples may use `##`/`###` headings.
 * They would clash with the top-level llms.txt structure (parser treats `##`
 * as section dividers). Demote any heading with two or more `#` by two levels,
 * capping at six.
 */
function demoteHeadings(text) {
  return text.replace(/^(#{2,})(\s+)/gm, (_match, hashes, sp) => {
    const next = '#'.repeat(Math.min(6, hashes.length + 2));
    return next + sp;
  });
}

function resolveModule(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // package import — out of scope
  const baseDir = path.dirname(fromFile);
  const candidates = [
    spec + '.ts',
    spec + '.tsx',
    path.join(spec, 'index.ts'),
    path.join(spec, 'index.tsx'),
  ];
  for (const rel of candidates) {
    const abs = path.resolve(baseDir, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

function renderLlmsTxt({ meta, docs, symbols }) {
  const lines = [];

  // Header
  lines.push(`# ${meta.displayName} - LLM Integration Guide`);
  lines.push(
    `# AUTO-GENERATED. Edit docs/llms/*.md or JSDoc in src/ and run npm run generate:llms.`
  );
  lines.push('');
  if (meta.description) lines.push(`> ${meta.description}`);
  lines.push(`> Package: ${meta.name}  •  Version: ${meta.version}`);
  lines.push('');

  // Table of contents
  if (docs.length > 0) {
    lines.push('## Table of Contents');
    for (const doc of docs) {
      lines.push(`- ${doc.file} — ${doc.title}`);
    }
    if (symbols.length > 0) {
      lines.push('- API Reference (auto-generated from JSDoc)');
    }
    lines.push('');
  }

  // Doc sections
  let n = 1;
  for (const doc of docs) {
    for (const section of doc.sections) {
      lines.push(`## ${n}. ${section.heading}`);
      lines.push('');
      if (section.body) {
        lines.push(section.body);
        lines.push('');
      }
      n++;
    }
  }

  // API Reference
  if (symbols.length > 0) {
    lines.push(`## ${n}. API Reference`);
    lines.push('');
    lines.push('_Auto-generated from JSDoc on public exports._');
    lines.push('');

    for (const sym of symbols) {
      lines.push(`### ${sym.name}`);
      lines.push('');
      lines.push(`**Kind:** \`${sym.kind}\``);
      lines.push('');
      if (sym.description) {
        lines.push(demoteHeadings(sym.description));
        lines.push('');
      }
      lines.push('**Signature:**');
      lines.push('```typescript');
      lines.push(sym.signature);
      lines.push('```');
      lines.push('');

      const params = sym.tags.filter((t) => t.tag === 'param' && t.name);
      if (params.length > 0) {
        lines.push('**Parameters:**');
        for (const p of params) lines.push(`- \`${p.name}\` — ${p.text}`);
        lines.push('');
      }

      const typeParams = sym.tags.filter((t) => t.tag === 'typeParam' && t.name);
      if (typeParams.length > 0) {
        lines.push('**Type Parameters:**');
        for (const p of typeParams) lines.push(`- \`${p.name}\` — ${p.text}`);
        lines.push('');
      }

      const ret = sym.tags.find((t) => t.tag === 'returns' || t.tag === 'return');
      if (ret) {
        lines.push(`**Returns:** ${ret.text}`);
        lines.push('');
      }

      const examples = sym.tags.filter((t) => t.tag === 'example');
      if (examples.length > 0) {
        lines.push('**Examples:**');
        lines.push('');
        for (const ex of examples) {
          lines.push(demoteHeadings(ex.text));
          lines.push('');
        }
      }

      const deprecated = sym.tags.find((t) => t.tag === 'deprecated');
      if (deprecated) {
        lines.push(`**Deprecated:** ${deprecated.text || '(no message)'}`);
        lines.push('');
      }

      const sees = sym.tags.filter((t) => t.tag === 'see');
      if (sees.length > 0) {
        lines.push('**See also:**');
        for (const s of sees) lines.push(`- ${s.text}`);
        lines.push('');
      }

      const relSource = path.relative(process.cwd(), sym.sourcePath).replace(/\\/g, '/');
      lines.push(`_Source: ${relSource}_`);
      lines.push('');
    }
  }

  // Trim trailing blank lines, then ensure single newline at EOF.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}
