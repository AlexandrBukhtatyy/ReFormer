/**
 * Находит РЕАЛЬНЫЕ вызовы методов классов @reformer/* через type checker.
 *
 * Импорты показывают только «что притащили», а не «что дёргают». Здесь для каждого
 * `recv.method(...)` тип получателя резолвится checker-ом, и если он объявлен как класс
 * из нашего списка — вызов записывается. Это то, что нельзя получить регуляркой.
 *
 * Плюс: вызовы импортированных функций (не методов) — по резолву идентификатора
 * до его объявления в файле-источнике.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { ROOT, CALLS, ensureVizDir } from './paths.mjs';

const PKGS = [
  ['core', 'reformer'],
  ['cdk', 'reformer-cdk'],
  ['renderer-react', 'reformer-renderer-react'],
  ['renderer-json', 'reformer-renderer-json'],
  ['ui-kit', 'reformer-ui-kit'],
  ['mcp', 'reformer-mcp'],
];

/** Пакет, которому принадлежит файл (по пути), либо null. */
function ownerOf(file) {
  const n = file.replace(/\\/g, '/');
  for (const [key, dir] of PKGS) {
    if (n.includes(`/packages/${dir}/`)) return key;
  }
  return null;
}
/** Путь внутри src пакета. */
function relOf(file, pkgDir) {
  const n = file.replace(/\\/g, '/');
  const marker = `/packages/${pkgDir}/src/`;
  const i = n.indexOf(marker);
  return i === -1 ? null : n.slice(i + marker.length);
}

const methodCalls = []; // {fromPkg, fromFile, toPkg, toFile, cls, method}
const fnCalls = []; // {fromPkg, fromFile, toPkg, toFile, fn}

for (const [key, dir] of PKGS) {
  const cfgPath = path.join(ROOT, 'packages', dir, 'tsconfig.json');
  if (!fs.existsSync(cfgPath)) continue;
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    cfg.config,
    ts.sys,
    path.join(ROOT, 'packages', dir)
  );
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker();

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    const fromPkg = ownerOf(sf.fileName);
    if (fromPkg !== key) continue; // только файлы своего пакета
    const fromFile = relOf(sf.fileName, dir);
    if (!fromFile || /\.(test|spec)\.tsx?$/.test(fromFile)) continue;

    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;

        // ---- recv.method(...)
        if (ts.isPropertyAccessExpression(callee)) {
          const method = callee.name.text;
          try {
            const t = checker.getTypeAtLocation(callee.expression);
            const decls = t.getSymbol()?.getDeclarations() ?? [];
            for (const d of decls) {
              if (!ts.isClassDeclaration(d) || !d.name) continue;
              const declFile = d.getSourceFile().fileName;
              const toPkg = ownerOf(declFile);
              if (!toPkg) continue;
              const toDir = PKGS.find(([k]) => k === toPkg)[1];
              const toFile = relOf(declFile, toDir) ?? path.basename(declFile);
              methodCalls.push({ fromPkg, fromFile, toPkg, toFile, cls: d.name.text, method });
              break;
            }
          } catch {
            /* тип не резолвится — пропускаем, ничего не выдумываем */
          }
        }

        // ---- функция(...) — резолвим идентификатор до объявления
        if (ts.isIdentifier(callee)) {
          try {
            const sym = checker.getSymbolAtLocation(callee);
            const target =
              sym && sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
            const d = target?.getDeclarations?.()?.[0];
            if (d) {
              const declFile = d.getSourceFile().fileName;
              const toPkg = ownerOf(declFile);
              if (toPkg) {
                const toDir = PKGS.find(([k]) => k === toPkg)[1];
                const toFile = relOf(declFile, toDir) ?? path.basename(declFile);
                if (toFile !== fromFile || toPkg !== fromPkg) {
                  fnCalls.push({ fromPkg, fromFile, toPkg, toFile, fn: callee.text });
                }
              }
            }
          } catch {
            /* пропускаем */
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  console.error(`  ${key}: разобрано`);
}

// свёртка
const key = (o, ...f) => f.map((k) => o[k]).join('|');
const roll = (arr, fields, label) => {
  const m = new Map();
  for (const c of arr) {
    const k = key(c, ...fields);
    if (!m.has(k))
      m.set(k, { ...Object.fromEntries(fields.map((f) => [f, c[f]])), names: new Set(), count: 0 });
    m.get(k).names.add(c[label]);
    m.get(k).count++;
  }
  return [...m.values()].map((x) => ({ ...x, names: [...x.names].sort() }));
};

const out = {
  methodCalls: roll(methodCalls, ['fromPkg', 'fromFile', 'toPkg', 'toFile', 'cls'], 'method'),
  fnCalls: roll(fnCalls, ['fromPkg', 'fromFile', 'toPkg', 'toFile'], 'fn'),
};

const OUT = process.argv[2] || CALLS;
ensureVizDir();
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.error(`\nвызовов методов (свёрнуто): ${out.methodCalls.length}`);
console.error(`вызовов функций (свёрнуто): ${out.fnCalls.length}`);
console.error('→ ' + OUT);
