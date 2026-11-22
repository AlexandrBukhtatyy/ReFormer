/**
 * Извлекает структуру кода @reformer/* через компилятор TypeScript.
 *
 * Для каждого пакета: каталоги -> файлы -> экспортируемые символы (тип/функция/класс/...),
 * плюс граф импортов на уровне файлов с именами импортируемых символов.
 * Ничего не эвристит по регуляркам: разбор через ts.createSourceFile.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { ROOT, CODE_STRUCTURE, ensureVizDir } from './paths.mjs';

const PKGS = [
  { dir: 'reformer', name: '@reformer/core', key: 'core' },
  { dir: 'reformer-cdk', name: '@reformer/cdk', key: 'cdk' },
  { dir: 'reformer-renderer-react', name: '@reformer/renderer-react', key: 'renderer-react' },
  { dir: 'reformer-renderer-json', name: '@reformer/renderer-json', key: 'renderer-json' },
  { dir: 'reformer-ui-kit', name: '@reformer/ui-kit', key: 'ui-kit' },
  { dir: 'reformer-mcp', name: '@reformer/mcp', key: 'mcp' },
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '__snapshots__'].includes(e.name)) continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const isExported = (node) =>
  node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

/** Публичные методы класса (без private/protected и без конструктора). */
function classMethods(node) {
  const out = [];
  for (const m of node.members) {
    if (!ts.isMethodDeclaration(m) || !m.name) continue;
    const mods = m.modifiers ?? [];
    if (mods.some((x) => x.kind === ts.SyntaxKind.PrivateKeyword)) continue;
    if (mods.some((x) => x.kind === ts.SyntaxKind.ProtectedKeyword)) continue;
    const n = m.name.getText?.() ?? String(m.name.escapedText ?? '');
    if (n && !n.startsWith('#')) out.push(n);
  }
  return out;
}

/** Является ли объявление React-компонентом (JSX в теле) или хуком (имя useX). */
function flavor(name, node, src) {
  if (/^use[A-Z]/.test(name)) return 'hook';
  const text = node.getText(src);
  if (/<[A-Z][\w.]*[\s/>]/.test(text) || /jsx\(|jsxs\(/.test(text)) return 'component';
  return null;
}

const result = {};

for (const pkg of PKGS) {
  const srcDir = path.join(ROOT, 'packages', pkg.dir, 'src');
  const files = walk(srcDir);
  const entry = { name: pkg.name, key: pkg.key, dir: pkg.dir, files: {} };

  for (const abs of files) {
    const rel = path.relative(srcDir, abs).replace(/\\/g, '/');
    const code = fs.readFileSync(abs, 'utf8');
    const src = ts.createSourceFile(
      abs,
      code,
      ts.ScriptTarget.Latest,
      true,
      abs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    const symbols = [];
    const imports = [];
    let reexports = 0;

    for (const node of src.statements) {
      // ---- импорты
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        const spec = node.moduleSpecifier.text;
        const names = [];
        let typeOnly = node.importClause?.isTypeOnly ?? false;
        const nb = node.importClause?.namedBindings;
        if (node.importClause?.name) names.push(node.importClause.name.text);
        if (nb && ts.isNamedImports(nb)) {
          for (const el of nb.elements) names.push(el.name.text);
        } else if (nb && ts.isNamespaceImport(nb)) {
          names.push('* as ' + nb.name.text);
        }
        imports.push({ spec, names, typeOnly });
        continue;
      }
      // ---- реэкспорты (barrel)
      if (ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) {
          reexports++;
          const spec = node.moduleSpecifier.text;
          const names = [];
          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const el of node.exportClause.elements) names.push(el.name.text);
          }
          imports.push({ spec, names, typeOnly: node.isTypeOnly, reexport: true });
        }
        continue;
      }
      if (!isExported(node)) continue;

      // ---- объявления
      if (ts.isFunctionDeclaration(node) && node.name) {
        const n = node.name.text;
        symbols.push({ name: n, kind: flavor(n, node, src) ?? 'function' });
      } else if (ts.isClassDeclaration(node) && node.name) {
        symbols.push({ name: node.name.text, kind: 'class', methods: classMethods(node) });
      } else if (ts.isInterfaceDeclaration(node)) {
        symbols.push({ name: node.name.text, kind: 'interface' });
      } else if (ts.isTypeAliasDeclaration(node)) {
        symbols.push({ name: node.name.text, kind: 'type' });
      } else if (ts.isEnumDeclaration(node)) {
        symbols.push({ name: node.name.text, kind: 'enum' });
      } else if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (!ts.isIdentifier(d.name)) continue;
          const n = d.name.text;
          let kind = 'const';
          const init = d.initializer;
          if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
            kind = flavor(n, d, src) ?? 'function';
          } else if (init && ts.isCallExpression(init)) {
            const callee = init.expression.getText(src);
            if (/forwardRef|memo/.test(callee)) kind = 'component';
          }
          symbols.push({ name: n, kind });
        }
      }
    }

    // Перегрузки дают несколько объявлений с одним именем — схлопываем.
    const seen = new Map();
    for (const s of symbols) {
      const prev = seen.get(s.name);
      if (!prev) {
        if (s.methods) s.methods = [...new Set(s.methods)];
        seen.set(s.name, s);
      } else {
        prev.overloads = (prev.overloads ?? 1) + 1;
      }
    }

    entry.files[rel] = {
      symbols: [...seen.values()],
      imports,
      reexports,
      isBarrel: seen.size === 0 && reexports > 0,
      loc: code.split('\n').length,
    };
  }
  result[pkg.key] = entry;
}

const OUT = process.argv[2] || CODE_STRUCTURE;
ensureVizDir();
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));

// сводка
for (const v of Object.values(result)) {
  const files = Object.values(v.files);
  const syms = files.reduce((a, f) => a + f.symbols.length, 0);
  const cls = files.reduce((a, f) => a + f.symbols.filter((s) => s.kind === 'class').length, 0);
  console.log(
    `${v.name.padEnd(26)} файлов ${String(files.length).padStart(4)}  символов ${String(syms).padStart(5)}  классов ${String(cls).padStart(3)}`
  );
}
console.log('\n→ ' + OUT);
