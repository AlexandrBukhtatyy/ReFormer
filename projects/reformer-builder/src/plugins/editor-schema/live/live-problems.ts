/**
 * Находки в живой форме: что подсветить на узлах и что сказать полосой.
 *
 * ## Два источника, одна полоса
 *
 * Свод документа приходит из службы диагностик — это находки валидаторов схемы и находки
 * сборки, отнесённые к самому документу. Находки сборки ЧУЖИХ файлов (сайдкаров) приходят
 * от поверхности строками: их адрес — другой ресурс, и в своде документа их нет, а живой
 * вид обязан объяснить, почему валидация молчит, — «validation.ts не компилируется» и есть
 * ответ. Полоса показывает оба источника подряд: сначала свод по строгости, потом сборку.
 *
 * ## Контур — по худшей находке узла
 *
 * Узел с ошибкой и предупреждением обводится как узел с ошибкой: контур — сигнал, а не
 * оформление, и то же правило действует в дереве файлов и на канвасе. Находки без узла
 * (ошибка разбора, сбой сборки) контура не получают — обвести им нечего, — и живут в полосе.
 *
 * ## Полоса ограничена по высоте
 *
 * Шесть строк, дальше — счётчик. Форма — то, ради чего вид открыт, и полоса, съевшая половину
 * высоты списком из тридцати предупреждений, отвечала бы на вопрос панели проблем, а не свой.
 *
 * @module plugins/editor-schema/live/live-problems
 */

import { SEVERITY_RANK } from '@/sdk';
import type { Diagnostic, DiagnosticSeverity } from '@/sdk';
import { indexNodeDiagnostics } from '../canvas/node-diagnostics';
import type { NodeId, Translate } from '../host';

/** Сколько строк полоса показывает целиком. Остальное — одним счётчиком. */
export const MAX_LIVE_PROBLEMS = 6;

/** Одна строка полосы: строгость задаёт значок и цвет, текст уже переведён. */
export interface LiveProblemRow {
  readonly key: string;
  readonly severity: DiagnosticSeverity;
  readonly text: string;
}

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

/**
 * Строки полосы: свод документа от строгих к мягким, затем находки сборки чужих файлов.
 *
 * Сортировка устойчивая: внутри одной строгости остаётся порядок свода, и строка не
 * перескакивает от того, что валидатор сходил заново. Сборка идёт ошибками: несобравшийся
 * сайдкар — это форма, которая не делает того, что в нём написано.
 */
export function liveProblemRows(
  items: readonly Diagnostic[],
  build: readonly string[],
  message: Translate
): readonly LiveProblemRow[] {
  const rows: LiveProblemRow[] = [...items]
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .map((item, index) => ({
      key: `d${index}`,
      severity: item.severity,
      text: message(item.code, item.params),
    }));
  build.forEach((text, index) => {
    rows.push({ key: `b${index}`, severity: 'error', text });
  });
  return rows;
}

/** Что показать целиком и сколько спрятать за счётчик. */
export function splitLiveProblems(rows: readonly LiveProblemRow[]): {
  readonly shown: readonly LiveProblemRow[];
  readonly hidden: number;
} {
  const shown = rows.slice(0, MAX_LIVE_PROBLEMS);
  return { shown, hidden: rows.length - shown.length };
}

/** Один и тот же список строк — незачем будить перерисовку. */
export function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
