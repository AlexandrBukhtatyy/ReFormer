/**
 * Находки в живой форме: что подсветить на узлах.
 *
 * ## Контур — по худшей находке узла
 *
 * Узел с ошибкой и предупреждением обводится как узел с ошибкой: контур — сигнал, а не
 * оформление, и то же правило действует в дереве файлов и на канвасе. Находки без узла
 * (ошибка разбора, сбой сборки) контура не получают — обвести им нечего.
 *
 * ## Списка здесь нет
 *
 * Полоса над формой перечисляла свод построчно, пока показать его было больше негде. Теперь
 * весь свод — вместе с находками сборки чужих файлов (сайдкаров), которые превью кладёт в
 * общие диагностики под адресом файла, где чинить, — показывает вкладка «Проблемы» в нижней
 * панели. Вторая копия списка отнимала бы у формы высоту, ничего не добавляя.
 *
 * @module plugins/editor-schema/live/live-problems
 */

import type { Diagnostic, DiagnosticSeverity } from '@reformer/builder-plugin-api';
import { indexNodeDiagnostics } from '../canvas/node-diagnostics';
import type { NodeId } from '../host';

/** Пустой указатель: одна ссылка на все чистые формы. */
const NO_SEVERITIES: ReadonlyMap<NodeId, DiagnosticSeverity> = new Map();

/** Худшая находка каждого узла — то, чем задаётся его контур. */
export function worstByNode(items: readonly Diagnostic[]): ReadonlyMap<NodeId, DiagnosticSeverity> {
  const indexed = indexNodeDiagnostics(items);
  if (indexed.size === 0) return NO_SEVERITIES;
  const out = new Map<NodeId, DiagnosticSeverity>();
  for (const [id, node] of indexed) out.set(id, node.worst);
  return out;
}
