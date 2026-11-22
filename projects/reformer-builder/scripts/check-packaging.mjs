#!/usr/bin/env node
// Guard: `@reformer/builder` у ПОТРЕБИТЕЛЯ — то, чего внутри монорепозитория не видно.
// Workspace-симлинк отдаёт приложению-образцу всё дерево пакета, поэтому любая дыра в `files`
// и `exports` здесь молча зеленеет: так в реестр ушёл 3.0.0-beta.14 без `exports`, без плагина
// Vite и без клиента. Проверяется ровно то, что получит приложение из тарбола:
//   1. раскладка: клиент собранным (`client/`), плагин (`vite/`), интерфейс с плагинами
//      (`dist/`), лаунчер (`bin/`) — и НЕТ `src/` (иначе `ui: auto` у плагина увидел бы исходники);
//   2. оба входа импортируются без сборщика: `@reformer/builder`, `/noop`, `/vite`;
//   3. прод-сборка приложения с плагином НЕ содержит клиента билдера (его подменяет заглушка),
//      а без плагина — содержит: иначе проверка слепа, и исключать мог бы tree-shaking;
//   4. типы обоих входов читает `tsc` потребителя.
//
// Как в mcp/check-subpaths: npm pack → чистый проект в os.tmpdir() → npm install тарбола
// и peer'ов из реестра → пробы В песочнице, где пакет резолвится как у потребителя.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(pkgDir, '../..');
const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

/** Маркер настоящего клиента: атрибут кнопки и рамки. В заглушке его нет. */
const CLIENT_MARKER = 'data-reformer-builder';

/** Что обязано лежать в пакете. Проверяется и до упаковки (сборка есть?), и после установки. */
const SHIPPED = [
  'vite/plugin.mjs',
  'vite/plugin.d.mts',
  'client/index.js',
  'client/index.d.ts',
  'client/noop.js',
  'client/noop.d.ts',
  'dist/index.html',
  'dist/plugins/index.json',
  'bin/reformer-builder.mjs',
];

// 0. Предусловия — до того, как тратить минуту на npm install.
const unbuilt = SHIPPED.filter((rel) => !existsSync(path.join(pkgDir, rel)));
if (unbuilt.length > 0) {
  console.error(`✗ @reformer/builder packaging: нет сборки — ${unbuilt.join(', ')}`);
  console.error(
    '  Собери: npm run build -w @reformer/builder' +
      ' && npm run plugins:dist -w reformer-builder-playground' +
      ' && npm run build:plugins -w @reformer/builder'
  );
  process.exit(1);
}

// npm через его JS-entry (npm_execpath), иначе на Windows execFile не спавнит npm.cmd
// без shell, а shell ломается о пробелы в путях (тот же приём, что в check-subpaths).
const npmExecpath = process.env.npm_execpath;
const viaNode = Boolean(npmExecpath?.endsWith('.js'));
const onWindows = process.platform === 'win32';

// Конфиг монорепо не должен протекать в песочницу (корневой .npmrc с legacy-peer-deps
// отключил бы автоустановку peer'ов) — моделируем дефолтный npm.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !key.startsWith('npm_config_') && !key.startsWith('npm_package_')
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

/** Версия для песочницы — та, против которой собран сам пакет. */
function pinned(name) {
  const range = pkg.devDependencies[name];
  if (range === undefined) throw new Error(`в devDependencies @reformer/builder нет ${name}`);
  return range;
}

/** Есть ли маркер клиента хоть в одном JS-файле сборки приложения. */
function bundleHasClient(outDir) {
  const assets = path.join(outDir, 'assets');
  return readdirSync(assets)
    .filter((file) => file.endsWith('.js'))
    .some((file) => readFileSync(path.join(assets, file), 'utf8').includes(CLIENT_MARKER));
}

const sandbox = mkdtempSync(path.join(os.tmpdir(), 'reformer-builder-packaging-'));
const tarballs = path.join(sandbox, 'tarballs');
const consumer = path.join(sandbox, 'consumer');
mkdirSync(tarballs);
mkdirSync(path.join(consumer, 'src'), { recursive: true });

const failures = [];
try {
  console.log(`  песочница: ${sandbox}`);

  // 1-2. Тарбол и приложение-потребитель с peer'ами из реестра.
  const dependencies = {
    [pkg.name]: `file:${pack(pkgDir, tarballs)}`,
    react: pinned('react'),
    'react-dom': pinned('react-dom'),
    vite: pinned('vite'),
    '@vitejs/plugin-react': pinned('@vitejs/plugin-react'),
    '@types/react': pinned('@types/react'),
    '@types/node': pinned('@types/node'),
  };
  writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify(
      {
        name: 'builder-packaging-smoke',
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

  // 3. Раскладка установленного пакета — по файлам, без импорта.
  const installed = path.join(consumer, 'node_modules', '@reformer', 'builder');
  for (const rel of SHIPPED) {
    if (!existsSync(path.join(installed, rel))) failures.push(`в пакете нет ${rel} (поле files?)`);
  }
  if (existsSync(path.join(installed, 'src'))) {
    failures.push(
      'в пакет уехал src/: клиент обязан ехать собранным, а `ui: auto` увидит исходники'
    );
  }
  const noopSource = readFileSync(path.join(installed, 'client', 'noop.js'), 'utf8');
  if (noopSource.includes('ReformerBuilder.js') || noopSource.includes('FormStand')) {
    failures.push('client/noop.js тянет настоящий клиент: type-only реэкспорт не стёрся');
  }
  if (!readFileSync(path.join(installed, 'client', 'index.js'), 'utf8').includes(CLIENT_MARKER)) {
    failures.push(`в client/index.js нет маркера «${CLIENT_MARKER}»: проверка исключения слепа`);
  }

  // 4. Оба входа импортируются без сборщика — системным node из песочницы.
  writeFileSync(
    path.join(consumer, 'smoke.mjs'),
    `
const failures = [];
const client = await import('@reformer/builder');
const noop = await import('@reformer/builder/noop');
const vite = await import('@reformer/builder/vite');
if (typeof client.ReformerBuilder !== 'function') failures.push('@reformer/builder: нет ReformerBuilder');
if (typeof noop.ReformerBuilder !== 'function') failures.push('@reformer/builder/noop: нет ReformerBuilder');
if (JSON.stringify(Object.keys(client).sort()) !== JSON.stringify(Object.keys(noop).sort())) {
  failures.push('экспорты клиента и заглушки расходятся: ' + Object.keys(client) + ' / ' + Object.keys(noop));
}
const plugins = vite.reformerBuilder();
if (!Array.isArray(plugins) || plugins.length !== 2) failures.push('reformerBuilder(): ожидались два плагина');
else {
  if (plugins[0].name !== 'reformer-builder' || plugins[0].apply !== 'serve') failures.push('первый плагин — не dev-сервер');
  if (plugins[1].name !== 'reformer-builder:production' || plugins[1].apply !== 'build') failures.push('второй плагин — не прод-сборка');
}
console.log(JSON.stringify({ failures }));
`
  );
  const probe = execFileSync(process.execPath, ['smoke.mjs'], {
    cwd: consumer,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  failures.push(...JSON.parse(probe.trim().split('\n').pop()).failures);

  // 5. Прод-сборка приложения: с плагином клиента нет, без плагина — есть.
  writeFileSync(
    path.join(consumer, 'index.html'),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n'
  );
  writeFileSync(
    path.join(consumer, 'src', 'main.jsx'),
    `import { createRoot } from 'react-dom/client';
import { ReformerBuilder } from '@reformer/builder';

createRoot(document.getElementById('root')).render(
  <ReformerBuilder>
    <div>smoke</div>
  </ReformerBuilder>
);
`
  );
  writeFileSync(
    path.join(consumer, 'vite.config.mjs'),
    `import react from '@vitejs/plugin-react';
import { reformerBuilder } from '@reformer/builder/vite';

const withPlugin = process.env.SMOKE_WITHOUT_PLUGIN !== '1';
export default { plugins: withPlugin ? [react(), reformerBuilder()] : [react()], logLevel: 'error' };
`
  );
  // Исполняемый файл сборщика пакет наружу не объявляет — он находится от его манифеста
  // (тот же приём, что у e2e-сервера приложения-образца).
  const viteBin = path.join(
    path.dirname(createRequire(path.join(consumer, 'package.json')).resolve('vite/package.json')),
    'bin',
    'vite.js'
  );
  const build = (outDir, env) => {
    execFileSync(process.execPath, [viteBin, 'build', '--outDir', outDir], {
      cwd: consumer,
      env: { ...cleanEnv, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    return path.join(consumer, outDir);
  };
  console.log('  vite build приложения: с плагином и без…');
  if (bundleHasClient(build('dist-with-plugin', {}))) {
    failures.push('прод-сборка с плагином содержит клиент билдера: заглушка не подставилась');
  }
  if (!bundleHasClient(build('dist-without-plugin', { SMOKE_WITHOUT_PLUGIN: '1' }))) {
    failures.push(
      'контроль: сборка БЕЗ плагина не содержит клиента — исключает не псевдоним, проверка слепа'
    );
  }

  // 6. Типы обоих входов — tsc монорепозитория над пробой в песочнице.
  writeFileSync(
    path.join(consumer, 'types-probe.ts'),
    `import {
  ReformerBuilder,
  type FormModuleLoader,
  type ReformerBuilderLabels,
  type ReformerBuilderProps,
} from '@reformer/builder';
import { ReformerBuilder as Stub } from '@reformer/builder/noop';
import { reformerBuilder, type ReformerBuilderOptions } from '@reformer/builder/vite';

const labels: Partial<ReformerBuilderLabels> = { open: 'Открыть' };
export const props: ReformerBuilderProps = { projectBase: '/', enabled: true, labels };
export const loader: FormModuleLoader | undefined = undefined;
const options: ReformerBuilderOptions = { ui: 'dist' };
export const plugins = reformerBuilder(options);
// Одна сигнатура у клиента и заглушки — иначе псевдоним прод-сборки менял бы типы.
export const same: typeof Stub = ReformerBuilder;
`
  );
  const tsc = path.join(
    path.dirname(
      createRequire(path.join(repoRoot, 'package.json')).resolve('typescript/package.json')
    ),
    'bin',
    'tsc'
  );
  try {
    execFileSync(
      process.execPath,
      [
        tsc,
        '--noEmit',
        '--strict',
        '--module',
        'esnext',
        '--moduleResolution',
        'bundler',
        '--target',
        'es2022',
        '--lib',
        'es2022,dom',
        '--jsx',
        'react-jsx',
        '--skipLibCheck',
        '--types',
        'node',
        'types-probe.ts',
      ],
      { cwd: consumer, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
    failures.push(`типы не читаются у потребителя:\n${output}`);
  }

  if (failures.length > 0) {
    console.error(`✗ @reformer/builder packaging: ${failures.length} проблем(ы):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(
      '\n  Обычно причина — поля "files"/"exports" пакета или сборка клиента (`npm run build:client`).' +
        '\n  Проверь `npm pack --dry-run` и что `client/` собран из текущих исходников.'
    );
  } else {
    console.log(
      '✓ @reformer/builder: тарбол ставится, оба входа и плагин Vite работают, прод-сборка без клиента, типы читаются'
    );
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

process.exit(failures.length > 0 ? 1 : 0);
