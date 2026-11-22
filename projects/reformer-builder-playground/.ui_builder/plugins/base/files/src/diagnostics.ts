/**
 * Диагностика для дерева — чистая часть, без React и без реестров.
 *
 * Свод диагностик — плоский список находок по одному ресурсу. Дереву нужна **одна пометка
 * на файл**: значок со счётчиком и тон. Это правило, а не отрисовка: «какой тон у файла, где
 * есть и ошибка, и предупреждение» обязано иметь ответ, который можно проверить, а не
 * посмотреть глазами. Окружение тестов — `node`, поэтому граница проведена ровно здесь.
 *
 * Свод ресурса — худшая строгость и счётчики — считает SDK (`summarizeDiagnostics`): тот же
 * свод нужен значку журнала, а это другой плагин. Список находок теперь показывает журнал
 * (`base/journal`), а здесь осталась пометка в дереве — продолжение показа проекта.
 *
 * @module plugins/base/files/diagnostics
 */

import { summarizeDiagnostics } from '@reformer/builder-plugin-api';
import type { Decoration, Diagnostic, DiagnosticSeverity } from '@reformer/builder-plugin-api';

/** Строгость → тон пометки. Тон объявлен Host, здесь только соответствие. */
export const SEVERITY_TONE = Object.freeze({
  error: 'danger',
  warning: 'warning',
  info: 'default',
} as const) satisfies Record<DiagnosticSeverity, NonNullable<Decoration['tone']>>;

/**
 * Пометка файла по его своду. `null` — вкладу нечего сказать про этот ресурс.
 *
 * Тон — по ХУДШЕЙ находке, а счётчик считает все: файл с одной ошибкой и десятью
 * предупреждениями обязан выглядеть как файл с ошибкой, а значок «3» на файле с тремя
 * предупреждениями честнее, чем «0».
 *
 * Ключ подсказки — в пространстве имён ЭТОГО плагина: `tooltipKey` разрешается словарём
 * внёсшего (то же правило, что у заголовка панели). Счётчик уходит параметром, а не
 * вклеивается в строку: иначе перевод случался бы здесь, а не в момент показа, и смена
 * локали оставила бы на экране прежний язык.
 */
export function diagnosticDecoration(items: readonly Diagnostic[]): Decoration | null {
  const summary = summarizeDiagnostics(items);
  if (summary === null) return null;
  return {
    badge: String(summary.total),
    tone: SEVERITY_TONE[summary.worst],
    tooltipKey: `tree.problems.${summary.worst}`,
    tooltipParams: { count: summary.total },
  };
}
