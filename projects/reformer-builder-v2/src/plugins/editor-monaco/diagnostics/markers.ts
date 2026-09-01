/**
 * Диагностика → разметка редактора. Чистая часть: смещения, а не координаты Monaco.
 *
 * Перевод смещения в строку и колонку умеет только модель Monaco (`getPositionAt`),
 * и в `node` её нет. Поэтому здесь всё, что можно посчитать без редактора: какая цель
 * во что превращается, что делать с целью, которую в тексте не нашли, и как не выпустить
 * диапазон за границы буфера. Компонент дальше переводит смещения в позиции одним вызовом
 * на маркер.
 *
 * ## Три цели — три правила
 *
 * ```text
 * range     подчёркиваем как есть, зажав в границы текста
 * node      ищем идентификатор в тексте (см. node-ranges.ts); не нашли — в нерешённые
 * resource  проблема всего файла: якорь на первой строке
 * ```
 *
 * **Ресурсная цель не подчёркивает файл целиком.** Маркер на всём тексте закрашивает экран
 * и не сообщает ничего сверх того, что уже говорит пометка на файле в дереве. Первая строка —
 * то место, где ошибку «файл не той формы» ищут глазами, и ровно так же поступает VS Code
 * с ошибками уровня документа.
 *
 * **Нерешённые не выбрасываются молча.** Идентификаторы узлов записываются в файл при первом
 * сохранении, поэтому у только что открытого документа в тексте их может не быть вовсе, и
 * тогда подчеркнуть структурную ошибку физически нечем. Список таких целей — часть результата:
 * по нему видно, что диагностика не потерялась, а осталась без места.
 *
 * @module plugins/editor-monaco/diagnostics/markers
 */

import type { Diagnostic, DiagnosticSeverity, TextRange } from '@/sdk';
import type { NodeLocation } from './node-ranges';

/** Маркер до перевода в координаты Monaco. */
export interface MarkerDraft {
  readonly severity: DiagnosticSeverity;
  readonly range: TextRange;
  /** Ключ сообщения без префикса `errors.` — переводит тот, кто рисует. */
  readonly code: string;
  readonly params?: Record<string, unknown>;
  /** Идентификатор валидатора: попадает в поле `source` маркера и виден в подсказке. */
  readonly source: string;
}

export interface MarkerPlan {
  readonly markers: readonly MarkerDraft[];
  /** Идентификаторы узлов, которых в тексте нет. */
  readonly unresolved: readonly string[];
}

const EMPTY_PLAN: MarkerPlan = Object.freeze({
  markers: Object.freeze([]),
  unresolved: Object.freeze([]),
});

/** Есть ли среди находок хоть одна, адресованная узлом. Ради этого не строится указатель зря. */
export function hasNodeTargets(items: readonly Diagnostic[]): boolean {
  return items.some((item) => item.target.kind === 'node');
}

/** Зажимает диапазон в границы текста; порядок концов восстанавливается, а не считается ошибкой. */
function clamp(range: TextRange, length: number): TextRange {
  const start = Math.min(Math.max(range.start, 0), length);
  const end = Math.min(Math.max(range.end, start), length);
  return { start, end };
}

/** Первая строка целиком — якорь для проблемы всего ресурса. */
function firstLine(text: string): TextRange {
  const at = text.indexOf('\n');
  return { start: 0, end: at === -1 ? text.length : at };
}

/**
 * Раскладывает свод диагностик по местам в тексте.
 *
 * Указатель узлов передаётся, а не строится здесь: он считается по тексту, а текст меняется
 * реже, чем свод (одна правка — один пересчёт указателя, но несколько публикаций от разных
 * валидаторов). Строит его вызывающий и держит ровно столько, сколько живёт текст.
 */
export function planMarkers(
  items: readonly Diagnostic[],
  text: string,
  nodes: ReadonlyMap<string, NodeLocation>
): MarkerPlan {
  if (items.length === 0) return EMPTY_PLAN;

  const markers: MarkerDraft[] = [];
  const unresolved: string[] = [];

  for (const item of items) {
    let range: TextRange | null;
    switch (item.target.kind) {
      case 'range':
        range = clamp(item.target.range, text.length);
        break;
      case 'node': {
        const location = nodes.get(item.target.nodeId);
        if (location === undefined) {
          unresolved.push(item.target.nodeId);
          range = null;
          break;
        }
        range = clamp(location.anchor, text.length);
        break;
      }
      case 'resource':
        range = firstLine(text);
        break;
    }
    if (range === null) continue;
    markers.push({
      severity: item.severity,
      range,
      code: item.code,
      params: item.params,
      source: item.source,
    });
  }

  return { markers, unresolved };
}
