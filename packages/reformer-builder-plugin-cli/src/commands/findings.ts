/**
 * Замечания команд CLI — одним типом на `validate`, `build`, `dev`, `pack` и `catalog`.
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
  /** В каталоге вывода лежит то, чего прошлая сборка этого же плагина не писала. */
  | 'output-not-ours'
  /** Каталог вывода — сам каталог исходников. */
  | 'output-is-source'
  /** `npm pack` отказал. */
  | 'pack-failed'
  /** Кит, внесённый в точку `reformer.kit.source`, не назвал себя — реестр китов его не примет. */
  | 'kit-no-id'
  /** Каталог кита не проходит контракт каталога (`component-catalog.schema.json`). */
  | 'kit-invalid-catalog'
  /** Шапка кита и блок `kit` его каталога называют кит по-разному. */
  | 'kit-mismatch'
  /**
   * Конфиг генератора каталога (`catalog.config.mjs`) не годится: форма, имя без записи,
   * противоречие ролей, статика без решения, нарушенная биекция полей, непереносимый тип значения.
   */
  | 'catalog-config-invalid'
  /** Файл каталога разошёлся с тем, что дают типы кита (`catalog --check`). */
  | 'catalog-drift'
  /** Символ, который называет конфиг (запись, `kit.infra`, `kit.adapters`), вход кита не экспортирует. */
  | 'catalog-symbol-missing'
  /** Генератору каталога нужен TypeScript, а он не установлен. */
  | 'typescript-missing';

export type Finding =
  | PluginProblem
  | { readonly code: CliFindingCode; readonly message: string; readonly file?: string };

/** Одна строка для терминала: `✗ файл: сообщение`. */
export function formatFinding(finding: Finding): string {
  return `✗ ${finding.file === undefined ? '' : `${finding.file}: `}${finding.message}`;
}
