#!/usr/bin/env node
// Guard: каждый subpath из `exports` должен резолвиться у настоящего потребителя.
//
// Дополняет check-dist-deps.mjs с другой стороны: тот сверяет импорты статически,
// этот реально выполняет `import('@reformer/ui-kit/<subpath>')`. Заодно ловит
// ошибки в поле `files` (subpath объявлен, а файла в тарболе нет) и промахи
// exports-мапы.
//
// Ключевая тонкость: проверять надо ВНЕ монорепо. Node резолвит модули, поднимаясь
// по дереву каталогов, поэтому из любой папки внутри репозитория недостающая
// зависимость «находится» в корневом node_modules и проверка ложно зеленеет.
// Поэтому: npm pack → чистый проект в os.tmpdir() → npm install тарбола.
//
// Список того, что ставится рядом, берётся ИЗ МАНИФЕСТА (peerDependencies), а не
// хардкодится: если dist импортирует пакет, который нигде не объявлен, в песочнице
// его не будет и соответствующий subpath упадёт.
//
// Сиблинги @reformer/* ставятся локальными тарболами, а не из npm — проверяем
// текущий рабочий код, а не последний релиз.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(pkgDir, '../..');
const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

/** Локальные сиблинги, которые надо паковать вместо установки из npm. */
const LOCAL_PACKAGES = {
  '@reformer/core': path.join(repoRoot, 'packages/reformer'),
  '@reformer/cdk': path.join(repoRoot, 'packages/reformer-cdk'),
  '@reformer/renderer-react': path.join(repoRoot, 'packages/reformer-renderer-react'),
};

// npm запускаем через его JS-entry (`npm_execpath` выставляет сам npm при `npm run`):
// с Node 20+ execFile не умеет спавнить `npm.cmd` без shell, а shell на Windows
// ломается о пробелы в путях. Fallback — на случай прямого `node scripts/...`.
const npmExecpath = process.env.npm_execpath;
const viaNode = Boolean(npmExecpath?.endsWith('.js'));
const onWindows = process.platform === 'win32';

// Конфиг монорепо не должен протекать в песочницу: `npm run` экспортирует весь свой
// конфиг через npm_config_*, и корневой .npmrc с legacy-peer-deps=true отключил бы
// автоустановку peer-зависимостей. Потребитель ставит пакет дефолтным npm — его и
// моделируем, иначе проверка врёт (падает на чужих peer'ах вроде recharts→react-is).
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !key.toLowerCase().startsWith('npm_config_') && !key.startsWith('npm_package_')
  )
);

const run = (args, cwd) => {
  const [file, argv] = viaNode
    ? [process.execPath, [npmExecpath, ...args]]
    : [onWindows ? 'npm.cmd' : 'npm', onWindows ? args.map((a) => JSON.stringify(a)) : args];
  return execFileSync(file, argv, {
    cwd,
    env: cleanEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: !viaNode && onWindows,
  });
};

/** `npm pack` → абсолютный путь к тарболу. */
function pack(dir, dest) {
  const out = run(['pack', '--pack-destination', dest, '--loglevel=error'], dir);
  const name = out.trim().split('\n').pop().trim();
  return path.join(dest, name);
}

const sandbox = mkdtempSync(path.join(os.tmpdir(), 'reformer-ui-kit-subpaths-'));
const tarballs = path.join(sandbox, 'tarballs');
const consumer = path.join(sandbox, 'consumer');
mkdirSync(tarballs);
mkdirSync(consumer);

let failed = false;
try {
  console.log(`  песочница: ${sandbox}`);

  const dependencies = { [pkg.name]: `file:${pack(pkgDir, tarballs)}` };
  for (const [name, range] of Object.entries(pkg.peerDependencies ?? {})) {
    dependencies[name] = LOCAL_PACKAGES[name]
      ? `file:${pack(LOCAL_PACKAGES[name], tarballs)}`
      : range;
  }

  writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify(
      {
        name: 'ui-kit-subpath-smoke',
        version: '1.0.0',
        private: true,
        type: 'module',
        dependencies,
      },
      null,
      2
    )
  );

  console.log(`  npm install: ${Object.keys(dependencies).length} пакет(ов)…`);
  run(['install', '--no-audit', '--no-fund', '--loglevel=error'], consumer);

  // Раннер выполняется В песочнице: только там `@reformer/ui-kit` резолвится так же,
  // как у потребителя. Список subpath'ов читается из УСТАНОВЛЕННОГО package.json —
  // то есть из того, что реально попало в тарбол.
  const runner = `
import { readFileSync } from 'node:fs';
// Читаем манифест с диска, а не через require('<pkg>/package.json'): exports-мапа
// пакета не отдаёт ./package.json наружу.
const installed = JSON.parse(
  readFileSync('node_modules/${pkg.name}/package.json', 'utf8')
);
const subpaths = Object.keys(installed.exports).filter((k) => k !== './styles');
const failures = [];
for (const key of subpaths) {
  const specifier = key === '.' ? '${pkg.name}' : '${pkg.name}/' + key.slice(2);
  try {
    await import(specifier);
  } catch (error) {
    failures.push([specifier, error.message.split('\\n')[0]]);
  }
}
console.log(JSON.stringify({ total: subpaths.length, failures }));
`;
  writeFileSync(path.join(consumer, 'smoke.mjs'), runner);
  const raw = execFileSync(process.execPath, ['smoke.mjs'], {
    cwd: consumer,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const { total, failures } = JSON.parse(raw.trim().split('\n').pop());

  if (failures.length > 0) {
    failed = true;
    console.error(`\n✗ ${pkg.name}: не резолвится ${failures.length} из ${total} subpath:\n`);
    for (const [specifier, message] of failures) console.error(`  ${specifier}\n    ${message}`);
    console.error(
      '\n  Вероятная причина: dist импортирует пакет, которого нет ни в dependencies,\n' +
        '  ни в peerDependencies (тогда сначала упадёт check-dist-deps), либо файла нет\n' +
        '  в тарболе — проверьте поле "files".'
    );
  } else {
    console.log(`✓ ${pkg.name}: все ${total} subpath импортируются из npm-тарбола.`);
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
