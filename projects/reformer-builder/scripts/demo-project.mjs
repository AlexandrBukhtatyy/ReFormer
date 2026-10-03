#!/usr/bin/env node
/**
 * demo-project — проект для проверки сочетаний «движок × кит» с китом HexaUI.
 *
 * Кит HexaUI — внешний плагин: в составе билдера его нет, он живёт в каталоге открытого проекта
 * (`.ui_builder/plugins/kit-hexa-ui/`) и включается настройкой проекта. Поэтому готовые конфиги
 * `presets/*-hexa-ui.json` сами по себе HexaUI не показывают — им нужен проект, в котором плагин
 * лежит и включён. Этот скрипт такой проект собирает:
 *
 *   <проект>/.ui_builder/plugins/kit-hexa-ui/   сборка плагина (manifest.json, main.js, styles.css)
 *   <проект>/.ui_builder/settings.json          { "workspace.plugins.enabled": ["kit-hexa-ui"] }
 *   <проект>/forms/…                            по образцу формы на каждый движок
 *
 * Каталог по умолчанию — `.tmp/builder-presets-demo` в корне репозитория (в `.gitignore`).
 * Повторный запуск обновляет сборку плагина и образцы; свои формы и прочие настройки проекта
 * не трогает.
 *
 * Использование:
 *   npm run demo:project -w @reformer/builder [-- --out <каталог>]
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

/** Идентификатор плагина кита — имя его каталога в проекте и запись в списке включённых. */
const KIT_PLUGIN_ID = 'kit-hexa-ui';
const KIT_PACKAGE = '@reformer/kit-hexa-ui';
/** Ключ списка включённых плагинов проекта (`ENABLED_PLUGINS_SETTINGS_KEY` в shell/boot/boot). */
const ENABLED_PLUGINS_KEY = 'workspace.plugins.enabled';

function parseArgs(argv) {
  let out = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') out = argv[++i] ?? null;
    else if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
    else {
      console.error(`demo-project: неизвестный аргумент "${arg}" (ожидается --out <каталог>)`);
      process.exit(1);
    }
  }
  return { out: resolve(process.cwd(), out ?? join(repoRoot, '.tmp', 'builder-presets-demo')) };
}

/** npm-скрипт пакета монорепозитория; отказ — конец работы: дальше строить не из чего. */
function runWorkspaceScript(workspace, script, extra = []) {
  const args = ['run', script, '-w', workspace, ...(extra.length > 0 ? ['--', ...extra] : [])];
  // Через оболочку — иначе на Windows не находится `npm.cmd`. Команда передаётся ОДНОЙ строкой:
  // список аргументов оболочка всё равно склеила бы без экранирования (на что Node и ругается
  // предупреждением DEP0190), поэтому пути с пробелами заключает в кавычки вызывающий.
  const command = `npm ${args.join(' ')}`;
  const result = spawnSync(command, { cwd: repoRoot, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`demo-project: «${command}» завершился с кодом ${result.status}`);
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

/**
 * Включает плагин в настройках проекта, сохраняя всё, что там уже записано. Файл, который
 * не разбирается, не перезаписывается: это чужие настройки, и молча потерять их хуже отказа.
 */
function enablePlugin(settingsFile) {
  let settings = {};
  if (existsSync(settingsFile)) {
    try {
      const parsed = JSON.parse(readFileSync(settingsFile, 'utf8'));
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('ожидался JSON-объект');
      }
      settings = parsed;
    } catch (error) {
      console.error(`demo-project: «${settingsFile}» не разобран: ${error.message}`);
      process.exit(1);
    }
  }
  const enabled = Array.isArray(settings[ENABLED_PLUGINS_KEY])
    ? settings[ENABLED_PLUGINS_KEY].filter((id) => typeof id === 'string')
    : [];
  if (!enabled.includes(KIT_PLUGIN_ID)) enabled.push(KIT_PLUGIN_ID);
  settings[ENABLED_PLUGINS_KEY] = enabled;
  writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
}

const { out } = parseArgs(process.argv.slice(2));
const configDir = join(out, '.ui_builder');
const pluginDir = join(configDir, 'plugins', KIT_PLUGIN_ID);
mkdirSync(pluginDir, { recursive: true });

ensurePluginCli();
runWorkspaceScript(KIT_PACKAGE, 'plugin:build', ['--out', `"${pluginDir}"`]);
enablePlugin(join(configDir, 'settings.json'));
cpSync(join(here, 'demo-project', 'forms'), join(out, 'forms'), { recursive: true });

console.log(`
  Демо-проект готов: ${out}

  Дальше:
    npm run dev:reformer-hexa-ui -w @reformer/builder   (или dev:rjsf-hexa-ui)
    в билдере — «Открыть папку» и выбрать этот каталог.
`);
