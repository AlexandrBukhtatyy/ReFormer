/**
 * Дублирование выделения в направлении — «Copy Line» первой версии.
 *
 * Обычное дублирование ставит копию сразу за оригиналом и направления не знает. Здесь оно
 * есть: `⇧⌥↓` кладёт копию после блока, `⇧⌥↑` — перед ним, а в контейнере-ряду то же самое
 * делают `⇧⌥→` и `⇧⌥←`. Проекция на ось раскладки та же, что у перемещения ({@link './move'}):
 * стрелка означает то, что человек видит, а не то, как узлы лежат в JSON.
 *
 * ## Копия собирается ЗДЕСЬ, а не операцией `duplicate`
 *
 * `duplicate` кладёт копию в единственное место — сразу после оригинала, — и адрес ей выдаёт
 * применение. Для «перед блоком» этого мало: пришлось бы сначала дублировать, а потом двигать
 * копию, ссылаясь на адрес, которого в момент планирования ещё нет. Поэтому копия делается
 * заранее ({@link reissueNodeIds}) и вставляется `insert`-ом с сохранением адресов — ровно так же,
 * как это делает обёрточный бросок ({@link '../schematic/schematic-drop'}).
 *
 * Блок копируется целиком и одним составом: человек выделил три поля и ждёт три копии рядом,
 * а не три отдельных шага отмены.
 *
 * @module plugins/editor-schema/editing/duplicate
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { newNodeId, reissueNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { getAt, type JsonPath } from '@/lib/form-model/paths';
import { navIntentAt, type NavDir } from '@/lib/form-model/query';
import { blockOf, slotSegments } from '../model/block';
import { indexNodes } from '../model/node-index';
import { batchOp, insertOp } from '../model/ops';
import type { EditOp, NodeId } from '../host';

export interface DuplicateOptions {
  /** Генератор адресов для копий. В тестах — детерминированный. */
  readonly newId?: NodeIdFactory;
}

/**
 * Операция, которой станет дублирование в направлении, — или `null`.
 *
 * `null` означает «этой стрелкой здесь не дублируют»: поперёк оси копия не имеет места,
 * куда встать, — «внутрь» и «наружу» не про соседство, а про вложенность.
 */
export function planDuplicate(
  schema: JsonFormSchema,
  selection: readonly NodeId[],
  dir: NavDir,
  options: DuplicateOptions = {}
): EditOp | null {
  const index = indexNodes(schema);
  const block = blockOf(index, selection);
  if (block === null) return null;

  const slotPath: JsonPath = [...block.parentPath, ...slotSegments(block.slot)];
  const intent = navIntentAt(schema, [...slotPath, block.start], dir);
  if (intent !== 'prev' && intent !== 'next') return null;

  const list = getAt(schema, slotPath);
  if (!Array.isArray(list)) return null;

  const newId = options.newId ?? newNodeId;
  const at = intent === 'prev' ? block.start : block.start + block.count;

  const inserts: EditOp[] = [];
  for (let offset = 0; offset < block.count; offset += 1) {
    const source = (list as unknown[])[block.start + offset];
    // Текстовая часть `children` копируется вместе с блоком только как узел; без адреса
    // её не вставить `insert`-ом, поэтому такой блок не дублируется вовсе.
    if (typeof source !== 'object' || source === null) return null;
    const copy = reissueNodeIds(structuredClone(source) as JsonNode, newId);
    inserts.push(
      insertOp(copy, {
        parent: block.parentId,
        slot: block.slot,
        // Позиции идут подряд: каждая следующая копия встаёт правее предыдущей, поэтому
        // порядок внутри блока сохраняется и при вставке перед ним, и при вставке после.
        index: at + offset,
        keepIds: true,
      })
    );
  }

  return inserts.length === 1 ? inserts[0] : batchOp(inserts);
}
