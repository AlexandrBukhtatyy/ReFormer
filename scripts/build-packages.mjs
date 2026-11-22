#!/usr/bin/env node
/**
 * Сборка пакетов монорепо по зависимостям: `npm run build` в корне.
 *
 * Прежний корневой `build` был `npm run build --workspaces`, и он не работал вовсе: npm заходит
 * во все workspace, включая те, где скрипта `build` нет (`react-playground-e2e`), и падает на
 * первом из них. С `--if-present` эта ошибка уходит, но остаётся вторая: npm идёт по workspace в
 * порядке объявления, а не по зависимостям, и пакет собирается раньше `dist` соседа, из которого
 * берёт типы (`TS2307: Cannot find module '@reformer/core'`).
 *
 * Порядок — тот же, что у шагов сборки в `.github/workflows/test.yml`. Новый собираемый пакет
 * добавляется в оба места. Сборка останавливается на первом упавшем пакете: продолжать дальше
 * бессмысленно, следующие возьмут его старый `dist` или не найдут никакого.
 */

import { spawnSync } from 'node:child_process';

const PACKAGES = [
  '@reformer/core',
  '@reformer/cdk',
  '@reformer/renderer-react',
  '@reformer/ui-kit',
  '@reformer/renderer-json',
  '@reformer/form-registry',
  '@reformer/form-intent',
  '@reformer/mcp',
  '@reformer/builder-plugin-api',
  '@reformer/builder-toolkit',
  '@reformer/builder-plugin-cli',
  '@reformer/rjsf-kit-theme',
];

const started = Date.now();
for (const [i, pkg] of PACKAGES.entries()) {
  console.log(`\n▶ [${i + 1}/${PACKAGES.length}] ${pkg}`);
  // На Windows `npm` — это `npm.cmd`, запускаемый только через оболочку.
  const { status, error } = spawnSync('npm', ['run', 'build', '-w', pkg], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (status !== 0) {
    console.error(`\n✗ сборка ${pkg} упала${error ? `: ${error.message}` : ''}`);
    process.exit(status ?? 1);
  }
}
console.log(
  `\n✓ собрано пакетов: ${PACKAGES.length} за ${Math.round((Date.now() - started) / 1000)} с`
);
