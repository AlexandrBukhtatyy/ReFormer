/**
 * Свод находок ресурса, сжатый до того, что рисуется: худшая строгость и счётчики.
 *
 * Здесь, а не у каждого показывающего: свод нужен и пометке файла в дереве, и значку с группами
 * журнала, а это разные плагины, которые друг друга не видят. Копии совпадали бы по договорённости
 * — тот же довод, что у {@link SEVERITY_RANK} и отбора исправлений.
 *
 * ## Строгость побеждает: тон — по худшей находке
 *
 * Пометка — сигнал, а не оформление. Ресурс с одной ошибкой и десятью предупреждениями обязан
 * выглядеть как ресурс с ошибкой.
 *
 * ## Счётчик считает ВСЁ, а не только ошибки
 *
 * Значок «3» на ресурсе с тремя предупреждениями честнее, чем «0»: предупреждение — это тоже то,
 * что человек собирался увидеть в списке. Разделение по строгости несёт тон, а не число.
 *
 * @module @reformer/builder-plugin-api/services/diagnostics/summary
 */

import { SEVERITY_RANK, type Diagnostic, type DiagnosticSeverity } from './types.js';

/** Сколько находок каждой строгости. */
export interface SeverityCounts {
  readonly error: number;
  readonly warning: number;
  readonly info: number;
}

/** Свод ресурса, сжатый до того, что рисуется. */
export interface DiagnosticsSummary {
  /** Самая строгая находка ресурса — она и задаёт тон. */
  readonly worst: DiagnosticSeverity;
  readonly counts: SeverityCounts;
  /** Всего находок; совпадает с длиной свода. */
  readonly total: number;
}

/** Сжимает свод ресурса. `null` — находок нет, и это не то же самое, что «ноль ошибок». */
export function summarizeDiagnostics(items: readonly Diagnostic[]): DiagnosticsSummary | null {
  if (items.length === 0) return null;
  let error = 0;
  let warning = 0;
  let info = 0;
  let worst: DiagnosticSeverity = 'info';
  for (const item of items) {
    if (item.severity === 'error') error += 1;
    else if (item.severity === 'warning') warning += 1;
    else info += 1;
    if (SEVERITY_RANK[item.severity] > SEVERITY_RANK[worst]) worst = item.severity;
  }
  return { worst, counts: { error, warning, info }, total: items.length };
}
