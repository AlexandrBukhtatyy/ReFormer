/**
 * Сводка по стилям плагинов домена — для проверки в интеграционном прогоне.
 *
 * Класс без правила молчит: вёрстка не падает, а теряет отступ или цвет, и заметить это можно
 * только глазами. Поэтому соответствие «плагину нужны свои правила ⇔ он их везёт» проверяется
 * тестом, а не памятью: правка разметки плагина или чистка исходников билдера меняют разность
 * в любой момент.
 *
 * @module plugins/.shared/plugin-styles-report
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePluginStylesArgs, pluginStyles, PLUGIN_STYLES_SCRIPT } from './plugin-styles.mjs';

/** Команды, перед которыми таблица обязана быть собрана: все они читают манифест со стилями. */
const BEFORE = ['prebuild:dev', 'prebuild:dist', 'predev', 'prevalidate'] as const;

export interface PluginStylesReport {
  /** Каталог плагина внутри домена. */
  readonly plugin: string;
  /** Сколько правил Tailwind нужно плагину сверх CSS билдера. */
  readonly rules: number;
  /** Манифест объявляет таблицу стилей. */
  readonly declared: boolean;
  /** Пакет собирает таблицу перед каждой командой, которой она нужна. */
  readonly generated: boolean;
}

interface PackageJson {
  readonly scripts?: Readonly<Record<string, string>>;
}

/** Аргументы генератора из npm-скрипта пакета: всё, что стоит после пути к скрипту. */
function generatorArgs(script: string | undefined): string[] {
  if (script === undefined) return [];
  return script.trim().split(/\s+/).slice(2);
}

/** Плагины домена — подкаталоги с исходным манифестом; ядро и `integration/` его не имеют. */
export async function pluginStylesReport(domainDir: string): Promise<PluginStylesReport[]> {
  const report: PluginStylesReport[] = [];
  for (const plugin of readdirSync(domainDir).sort()) {
    const dir = join(domainDir, plugin);
    const manifestFile = join(dir, 'src', 'manifest.json');
    if (!existsSync(manifestFile)) continue;

    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as { styles?: unknown };
    const scripts =
      (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageJson).scripts ?? {};
    const options = parsePluginStylesArgs(generatorArgs(scripts[PLUGIN_STYLES_SCRIPT]), dir);
    const { rules } = await pluginStyles(dir, options);

    report.push({
      plugin,
      rules,
      declared: manifest.styles !== undefined,
      generated: BEFORE.every((hook) =>
        (scripts[hook] ?? '').includes(`npm run ${PLUGIN_STYLES_SCRIPT}`)
      ),
    });
  }
  return report;
}
