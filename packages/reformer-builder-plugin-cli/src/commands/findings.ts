/**
 * Замечания команд CLI — одним типом на `validate`, `build`, `dev` и `pack`.
 *
 * Отказы, которые знает оболочка, идут её кодами ({@link PluginProblem}): автор ищет их
 * в документации оболочки, и второй словарь для тех же бед только мешал бы. Свои коды у CLI —
 * только для того, чего оболочка не видит: `package.json`, сборки и каталога вывода.
 *
 * @module @reformer/builder-plugin-cli/commands/findings
 */

import type { PluginProblem } from '@reformer/builder-plugin-api/tooling';

export type CliFindingCode =
  /** Версия `package.json` не совпадает с версией манифеста. */
  | 'package-version'
  /** Сборщик отказал: синтаксис, неразрешённый импорт. */
  | 'build-failed'
  /** Импорт `@reformer/*`, которого оболочка не подставляет. */
  | 'module-unavailable'
  /** Код импортирует CSS: стили плагина объявляются в манифесте. */
  | 'css-from-code'
  /** Каталог вывода не пуст и не содержит сборку этого же плагина. */
  | 'output-not-ours'
  /** `npm pack` отказал. */
  | 'pack-failed';

export type Finding =
  | PluginProblem
  | { readonly code: CliFindingCode; readonly message: string; readonly file?: string };

/** Одна строка для терминала: `✗ файл: сообщение`. */
export function formatFinding(finding: Finding): string {
  return `✗ ${finding.file === undefined ? '' : `${finding.file}: `}${finding.message}`;
}
