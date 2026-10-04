#!/usr/bin/env node
/**
 * hexa-kit — сборка плагина кита HexaUI в этот проект.
 *
 * Кит HexaUI — внешний плагин: в составе билдера его нет, он живёт в каталоге открытого проекта
 * (`.ui_builder/plugins/kit-hexa-ui/`) и включается настройкой проекта. Поэтому готовые конфиги
 * `.ui_builder/presets/*-hexa-ui.json` сами по себе HexaUI не показывают — им нужен проект,
 * в котором плагин лежит и включён.
 *
 * Включён он здесь заранее: `kit-hexa-ui` значится в `.ui_builder/settings.json`. Не хватает
 * только сборки — она весит около 5 МБ (HexaUI с antd и styled-components) и в git не едет:
 * каталог вывода стоит в корневом `.gitignore`. Пока сборки нет, билдер рисует формы встроенным
 * китом и ни о чём не предупреждает.
 *
 * Повторный запуск обновляет сборку — после правки кита (`packages/ui-kits/reformer-hexa-ui`).
 *
 * Использование:
 *   npm run plugins:hexa-ui -w reformer-builder-playground
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const repoRoot = resolve(here, '../../..');

/** Идентификатор плагина кита — имя его каталога в проекте и запись в списке включённых. */
const KIT_PLUGIN_ID = 'kit-hexa-ui';
const KIT_PACKAGE = '@reformer/kit-hexa-ui';

/** npm-скрипт пакета монорепозитория; отказ — конец работы: дальше строить не из чего. */
function runWorkspaceScript(workspace, script, extra = []) {
  const args = ['run', script, '-w', workspace, ...(extra.length > 0 ? ['--', ...extra] : [])];
  // Через оболочку — иначе на Windows не находится `npm.cmd`. Команда передаётся ОДНОЙ строкой:
  // список аргументов оболочка всё равно склеила бы без экранирования (на что Node и ругается
  // предупреждением DEP0190), поэтому пути с пробелами заключает в кавычки вызывающий.
  const command = `npm ${args.join(' ')}`;
  const result = spawnSync(command, { cwd: repoRoot, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`hexa-kit: «${command}» завершился с кодом ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

/**
 * CLI автора плагина запускается из `dist/`, а в свежем клоне его там нет. Собираем вместе с SDK:
 * CLI импортирует его собранным.
 */
function ensurePluginCli() {
  const cli = join(repoRoot, 'packages', 'reformer-builder-plugin-cli', 'dist', 'cli.js');
  const sdk = join(repoRoot, 'packages', 'reformer-builder-plugin-api', 'dist', 'index.js');
  if (!existsSync(sdk)) runWorkspaceScript('@reformer/builder-plugin-api', 'build');
  if (!existsSync(cli)) runWorkspaceScript('@reformer/builder-plugin-cli', 'build');
}

const pluginDir = join(projectRoot, '.ui_builder', 'plugins', KIT_PLUGIN_ID);
mkdirSync(pluginDir, { recursive: true });

ensurePluginCli();
runWorkspaceScript(KIT_PACKAGE, 'plugin:build', ['--out', `"${pluginDir}"`]);

console.log(`
  Плагин кита HexaUI собран: ${pluginDir}

  Дальше:
    npm run preset:reformer-hexa-ui -w reformer-builder-playground   (или preset:rjsf-hexa-ui)
    в билдере — «Открыть папку…» и выбрать ${projectRoot}
`);
