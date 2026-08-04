/**
 * Собирает из code-structure.json + calls.json готовую модель «диаграммы кода»:
 * пакет -> каталоги -> файлы -> символы, плюс рёбра вызовов с именами функций.
 *
 * Всё, что урезается, фиксируется в поле caps — молчаливых обрезаний быть не должно.
 */
import fs from 'node:fs';
import { CODE_STRUCTURE, CALLS, CODE_MODEL, ensureVizDir } from './paths.mjs';

const S = JSON.parse(fs.readFileSync(CODE_STRUCTURE, 'utf8'));
const C = JSON.parse(fs.readFileSync(CALLS, 'utf8'));

const MAX_CHARS = 58; // ширина строки в боксе; длинные списки переносятся, а не режутся
const MAX_LINES_PER_GROUP = 3; // строк на одну группу символов, дальше «+N»
const MAX_METHODS = 8; // методов класса, дальше «+N»
const MAX_FILES_PER_DIR = 12; // файлов в боксе каталога, дальше «… ещё N»

/** Переносит список имён по строкам шириной MAX_CHARS с отступом продолжения. */
function wrapNames(prefix, names, cap = MAX_LINES_PER_GROUP) {
  const indent = ' '.repeat(prefix.length);
  const lines = [];
  let cur = '';
  let rest = 0;
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    const candidate = cur ? cur + ' ' + n : n;
    if (candidate.length + prefix.length > MAX_CHARS && cur) {
      lines.push(cur);
      if (lines.length >= cap) {
        rest = names.length - i;
        cur = '';
        break;
      }
      cur = n;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines.map(
    (l, i) => (i === 0 ? prefix : indent) + l + (i === lines.length - 1 && rest ? ` +${rest}` : '')
  );
}

const KIND_LABEL = {
  function: 'fn ',
  class: 'cls',
  interface: 'T  ',
  type: 'T  ',
  enum: 'T  ',
  const: 'c  ',
  component: '<> ',
  hook: 'use',
};

const dirOf = (f) => (f.includes('/') ? f.split('/').slice(0, -1).join('/') : '.');
const baseOf = (f) => f.split('/').pop();

const caps = [];

/** Строки содержимого одного файла. */
function fileLines(name, info) {
  const out = [];
  if (info.isBarrel) {
    out.push({ t: 'file', s: `${name}  — barrel (${info.reexports} реэкспорта)` });
    return out;
  }
  out.push({ t: 'file', s: name });

  const classes = info.symbols.filter((s) => s.kind === 'class');
  for (const c of classes) {
    const ms = c.methods ?? [];
    out.push({ t: 'sym', s: `cls ${c.name}` });
    const shown = ms.slice(0, MAX_METHODS);
    const tail = ms.length > MAX_METHODS ? ms.length - MAX_METHODS : 0;
    for (const l of wrapNames('    ', shown, 2)) {
      out.push({ t: 'meth', s: l });
    }
    if (tail) out.push({ t: 'meth', s: `    +${tail} метод(ов)` });
  }

  // остальные символы — по видам
  const groups = {};
  for (const s of info.symbols) {
    if (s.kind === 'class') continue;
    const g = KIND_LABEL[s.kind] ?? '?  ';
    (groups[g] = groups[g] ?? []).push(s.name);
  }
  for (const [label, names] of Object.entries(groups)) {
    for (const l of wrapNames(label + ' ', names)) out.push({ t: 'sym', s: l });
  }
  return out;
}

/** Бокс каталога: заголовок + вложенные боксы файлов. */
function dirBox(pkgKey, dirPath, files) {
  const sorted = files.sort((a, b) => b[1].symbols.length - a[1].symbols.length);
  const shown = sorted.slice(0, MAX_FILES_PER_DIR);
  if (sorted.length > MAX_FILES_PER_DIR) {
    caps.push(
      `${pkgKey}/${dirPath}: показано ${MAX_FILES_PER_DIR} из ${sorted.length} файлов (остальные — по убыванию числа символов)`
    );
  }
  const fileBoxes = shown.map(([name, info]) => {
    const all = fileLines(baseOf(name), info);
    return {
      name: all[0].s, // первая строка — имя файла (у barrel с пометкой)
      lines: all.slice(1), // остальное — символы
      symCount: info.symbols.length,
    };
  });
  const syms = files.reduce((a, [, i]) => a + i.symbols.length, 0);
  return {
    path: dirPath === '.' ? 'src/' : dirPath + '/',
    fileCount: files.length,
    symCount: syms,
    files: fileBoxes,
    hiddenFiles: Math.max(0, sorted.length - MAX_FILES_PER_DIR),
  };
}

const packages = [];

for (const key of ['core', 'cdk', 'renderer-react', 'renderer-json', 'mcp']) {
  const v = S[key];
  const byDir = {};
  for (const [f, info] of Object.entries(v.files)) {
    const d = dirOf(f);
    (byDir[d] = byDir[d] ?? []).push([f, info]);
  }
  const dirs = Object.entries(byDir)
    .map(([d, files]) => dirBox(key, d, files))
    .sort((a, b) => b.symCount - a.symCount);
  packages.push({
    key,
    name: v.name,
    fileCount: Object.keys(v.files).length,
    symCount: Object.values(v.files).reduce((a, f) => a + f.symbols.length, 0),
    dirs,
  });
}

// ---- ui-kit: 157 каталогов одного вида — показываем паттерн, а не 260 боксов
{
  const v = S['ui-kit'];
  const comps = new Set();
  const variants = {};
  let propFiles = 0;
  for (const f of Object.keys(v.files)) {
    const m = f.match(/^components\/([^/]+)\/variants\/([^/]+)\//);
    if (m) {
      comps.add(m[1]);
      variants[m[2]] = (variants[m[2]] ?? 0) + 1;
    }
    if (f.endsWith('.props.ts')) propFiles++;
  }
  const nonComp = Object.entries(v.files).filter(([f]) => !f.startsWith('components/'));
  const byDir = {};
  for (const [f, info] of nonComp) {
    const d = dirOf(f);
    (byDir[d] = byDir[d] ?? []).push([f, info]);
  }
  const dirs = Object.entries(byDir)
    .map(([d, files]) => dirBox('ui-kit', d, files))
    .sort((a, b) => b.symCount - a.symCount);

  const topVariants = Object.entries(variants)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  dirs.unshift({
    path: 'components/  — повторяющийся паттерн',
    fileCount: Object.keys(v.files).filter((f) => f.startsWith('components/')).length,
    symCount: 0,
    isPattern: true,
    hiddenFiles: 0,
    files: [
      {
        name: `${comps.size} компонентов, каждый по одной схеме:`,
        symCount: 0,
        lines: [
          { t: 'sym', s: '<name>/index.ts             — barrel компонента' },
          { t: 'sym', s: '<name>/variants/<v>/' },
          { t: 'sym', s: '     <name>-<v>.tsx         — сам компонент' },
          { t: 'sym', s: '     <name>-<v>.props.ts    — схема пропсов' },
        ],
      },
      {
        name: 'распределение',
        symCount: 0,
        lines: [
          { t: 'more', s: `варианты: ${topVariants.map(([n, c]) => n + ' ×' + c).join(', ')}` },
          { t: 'more', s: `${propFiles} файлов *.props.ts → источник meta.ts` },
        ],
      },
    ],
  });
  caps.push(
    `ui-kit: 157 каталогов components/<name>/variants/<variant>/ свёрнуты в один бокс-паттерн — они однотипны и по отдельности архитектурной информации не несут`
  );
  packages.push({
    key: 'ui-kit',
    name: v.name,
    fileCount: Object.keys(v.files).length,
    symCount: Object.values(v.files).reduce((a, f) => a + f.symbols.length, 0),
    dirs,
  });
}

// ---- рёбра вызовов
const edgeMap = new Map();
for (const e of [...C.fnCalls, ...C.methodCalls]) {
  const fromDir = dirOf(e.fromFile);
  const toDir = dirOf(e.toFile);
  const cross = e.fromPkg !== e.toPkg;
  if (!cross && fromDir === toDir) continue;
  // у ui-kit каталоги свёрнуты — сводим их к 'components/'
  const norm = (pkg, d) => (pkg === 'ui-kit' && d.startsWith('components/') ? 'components/' : d);
  const fd = norm(e.fromPkg, fromDir);
  const td = norm(e.toPkg, toDir);
  if (e.fromPkg === e.toPkg && fd === td) continue;
  const k = `${e.fromPkg}|${fd}|${e.toPkg}|${td}`;
  if (!edgeMap.has(k)) {
    edgeMap.set(k, {
      fromPkg: e.fromPkg,
      fromDir: fd,
      toPkg: e.toPkg,
      toDir: td,
      cross,
      names: new Set(),
    });
  }
  e.names.forEach((n) => edgeMap.get(k).names.add(n));
}
const edges = [...edgeMap.values()].map((e) => ({ ...e, names: [...e.names].sort() }));

const model = {
  packages,
  edges,
  caps,
  totals: {
    files: Object.values(S).reduce((a, v) => a + Object.keys(v.files).length, 0),
    symbols: Object.values(S).reduce(
      (a, v) => a + Object.values(v.files).reduce((x, f) => x + f.symbols.length, 0),
      0
    ),
    classes: Object.values(S).reduce(
      (a, v) =>
        a +
        Object.values(v.files).reduce(
          (x, f) => x + f.symbols.filter((s) => s.kind === 'class').length,
          0
        ),
      0
    ),
    methodCallEdges: C.methodCalls.length,
    fnCallEdges: C.fnCalls.length,
  },
};

const OUT = process.argv[2] || CODE_MODEL;
ensureVizDir();
fs.writeFileSync(OUT, JSON.stringify(model, null, 1));
console.log('пакетов:', packages.length);
for (const p of packages)
  console.log(
    `  ${p.name.padEnd(26)} ${String(p.dirs.length).padStart(2)} боксов, ${p.fileCount} файлов, ${p.symCount} символов`
  );
console.log(
  '\nрёбер вызовов:',
  edges.length,
  '(межпакетных:',
  edges.filter((e) => e.cross).length + ')'
);
console.log('ограничений зафиксировано:', caps.length);
console.log('→ ' + OUT);
