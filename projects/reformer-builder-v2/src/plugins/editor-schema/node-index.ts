/**
 * Указатель «идентификатор узла → путь»: то, чем операция превращает адрес в место правки.
 *
 * Операция приходит с {@link NodeId} (он переживает правку соседей), а все правки домена
 * адресуются `JsonPath` (он позиционный и дешёвый). Перевод между ними — обход схемы, и он
 * обязан быть ОДНИМ: два обхода по разным правилам разошлись бы на первом же неоднородном
 * слоте (`componentProps.steps`, `item.$template`, `wrapper`).
 *
 * Обход идёт через `walkNodes` домена, то есть по тем же слотам, что видит канвас. Узел,
 * не попавший в обход, для редактора не существует — и это правильнее, чем найти его вторым
 * способом и получить путь, по которому канвас ничего не рисует.
 *
 * Указатель строится на КАЖДУЮ операцию заново и живёт ровно её время. Кэш здесь был бы
 * кэшем производной от модели, которую операция сама и меняет; модель — снимок, и стоимость
 * обхода (порядок сотен узлов) несопоставима с ценой рассинхронизации.
 *
 * @module plugins/editor-schema/node-index
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { nodeIdOf } from '@/lib/form-model/node-id';
import { toPointer, type JsonPath } from '@/lib/form-model/paths';
import { walkNodes } from '@/lib/form-model/query';
import type { NodeId } from './host';

/** Узел вместе с адресом и путём — то, что операции нужно про цель. */
export interface NodeIndexEntry {
  readonly id: NodeId;
  readonly path: JsonPath;
  readonly node: JsonNode;
}

/** Двусторонний указатель по одной модели. */
export interface NodeIndex {
  /** Запись по идентификатору или `undefined`, если такого узла в модели нет. */
  find(id: NodeId): NodeIndexEntry | undefined;
  /** Идентификатор узла, лежащего по пути. */
  idAt(path: JsonPath): NodeId | undefined;
  /** Все записи в порядке обхода (корень первым). */
  entries(): readonly NodeIndexEntry[];
}

/**
 * Строит указатель по модели.
 *
 * Узлы без `$nodeId` пропускаются: идентификаторы выдаёт разбор ({@link '../../lib/form-model/node-id'.ensureNodeIds}),
 * и узел без него означает модель, собранную мимо провайдера. Молча выдать ему адрес здесь
 * значило бы спрятать эту ошибку до первой операции, которая по адресу не найдёт узла.
 */
export function indexNodes(schema: JsonFormSchema): NodeIndex {
  const byId = new Map<NodeId, NodeIndexEntry>();
  const byPointer = new Map<string, NodeId>();
  const all: NodeIndexEntry[] = [];

  walkNodes(schema, (node, path) => {
    const id = nodeIdOf(node);
    if (id === undefined) return;
    const entry: NodeIndexEntry = { id, path, node };
    all.push(entry);
    // Первый выигрывает: одинаковые идентификаторы — след копирования без перевыдачи,
    // и адресовать по ним второй узел значило бы править не тот, на который смотрят.
    if (!byId.has(id)) byId.set(id, entry);
    byPointer.set(toPointer(path), id);
  });

  return {
    find: (id) => byId.get(id),
    idAt: (path) => byPointer.get(toPointer(path)),
    entries: () => all,
  };
}
