/**
 * Диагностика на канвасе: свод ресурса → метки на узлах.
 *
 * Канвас рисует дерево узлов, а структурная находка адресована **идентификатором узла** —
 * сведение прямое и, в отличие от Monaco, ничего не ищет в тексте: узел здесь и есть строка.
 * Именно поэтому канвас — то место, где структурная диагностика видна ВСЕГДА, а
 * подчёркивание в редакторе — не всегда (там идентификатор надо сперва найти в буфере,
 * а он попадает в файл только при первом сохранении).
 *
 * ## Что сюда НЕ помещается
 *
 * Находка, адресованная диапазоном (`range`) или всем ресурсом (`resource`), узла не
 * называет, и повесить её на строку нельзя — любой выбранный узел был бы выдумкой.
 * Такие считаются отдельно ({@link unplacedCount}): канвас говорит, что они есть, а
 * показывает их панель проблем. Молча терять их нельзя — это ровно тот случай, из-за
 * которого в `markers.ts` заведён список нерешённых.
 *
 * ## Почему указатель, а не поиск на каждую строку
 *
 * Строк канваса — сотни, находок — единицы. Обход свода на каждую строку дал бы O(строки ×
 * находки) на каждую перерисовку; один проход по своду даёт то же самое отношение за O(находки)
 * и переживает перерисовку в `useMemo`.
 *
 * @module plugins/editor-schema/node-diagnostics
 */

import { SEVERITY_RANK, usableFixes } from '@/sdk';
import type { CommandLookup, Diagnostic, DiagnosticSeverity, QuickFix } from '@/sdk';
import type { NodeId, Translate } from './host';

/**
 * Старшинство строгости. Больше — строже.
 *
 * Своя таблица, а не заимствованная у Host: `plugins
/** Что известно про находки одного узла. */
export interface NodeDiagnostics {
  /** Самая строгая находка узла — она задаёт вид метки. */
  readonly worst: DiagnosticSeverity;
  readonly total: number;
  /** Находки узла в порядке свода: строгость метку задаёт, а порядок чтения — не меняет. */
  readonly items: readonly Diagnostic[];
}

/** Пустой указатель: одна ссылка вместо новой карты на каждую перерисовку чистой формы. */
export const NO_NODE_DIAGNOSTICS: ReadonlyMap<NodeId, NodeDiagnostics> = new Map();

/**
 * Раскладывает свод ресурса по узлам.
 *
 * Находки без узлового адреса пропускаются — их считает {@link unplacedCount}. Возвращается
 * общая пустая карта, если узловых находок нет вовсе: сравнение по ссылке в `useMemo`
 * дешевле, чем новая карта на каждый проход валидатора по чистой форме.
 */
export function indexNodeDiagnostics(
  items: readonly Diagnostic[]
): ReadonlyMap<NodeId, NodeDiagnostics> {
  const found = new Map<NodeId, { worst: DiagnosticSeverity; items: Diagnostic[] }>();
  for (const item of items) {
    if (item.target.kind !== 'node') continue;
    const nodeId = item.target.nodeId;
    const entry = found.get(nodeId);
    if (entry === undefined) {
      found.set(nodeId, { worst: item.severity, items: [item] });
      continue;
    }
    entry.items.push(item);
    if (SEVERITY_RANK[item.severity] > SEVERITY_RANK[entry.worst]) entry.worst = item.severity;
  }
  if (found.size === 0) return NO_NODE_DIAGNOSTICS;

  const index = new Map<NodeId, NodeDiagnostics>();
  for (const [nodeId, entry] of found) {
    index.set(nodeId, { worst: entry.worst, total: entry.items.length, items: entry.items });
  }
  return index;
}

/** Пустой список исправлений: одна ссылка вместо нового массива на каждую строку. */
const NO_FIXES: readonly QuickFix[] = Object.freeze([]);

/**
 * Исправления узла, которым есть чем исполниться прямо сейчас.
 *
 * Реестр команд спрашивается ВТОРОЙ раз — первый был при публикации находки. Это не
 * перестраховка: между публикацией и отрисовкой строки плагин, владеющий командой, могли
 * выключить, и кнопка, обещающая то, чего не сделает, — ровно тот дефект, ради которого
 * отбор и заводился.
 *
 * Порядок — порядок находок узла: строгость задаёт метку, а очередь кнопок — нет.
 */
export function nodeFixes(node: NodeDiagnostics, isRegistered: CommandLookup): readonly QuickFix[] {
  const out: QuickFix[] = [];
  for (const item of node.items) {
    for (const fix of usableFixes(item, isRegistered)) out.push(fix);
  }
  return out.length === 0 ? NO_FIXES : out;
}

/**
 * Сколько находок не легло ни на один узел.
 *
 * Считаются и `range`, и `resource`: для канваса разница между «ошибка разбора в этом месте
 * текста» и «это вообще не схема формы» одна — показать их строкой дерева нечем.
 */
export function unplacedCount(items: readonly Diagnostic[]): number {
  let count = 0;
  for (const item of items) if (item.target.kind !== 'node') count += 1;
  return count;
}

/**
 * Подпись метки узла: все его находки, по одной в строке.
 *
 * Перевод приходит функцией, а не делается здесь: коды диагностик живут в словаре **Host**
 * (`errors.<code>`), а плагин про раскладку чужого словаря не знает — приставку ставит
 * композиция. Здесь остаётся только порядок и склейка, и они проверяемы без i18n.
 *
 * Порядок — от строгих к мягким, сортировка устойчивая: внутри одной строгости сохраняется
 * порядок свода, поэтому строка не перескакивает от того, что валидатор сходил заново.
 */
export function nodeProblemTitle(node: NodeDiagnostics, message: Translate): string {
  return [...node.items]
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .map((item) => message(item.code, item.params))
    .join('\n');
}
