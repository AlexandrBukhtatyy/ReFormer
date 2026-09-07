/**
 * Навигация курсора в схематичном виде: следующий узел, который ВИДЕН.
 *
 * ## Зачем отдельно от {@link navTarget}
 *
 * Домен ходит по модели и про отрисовку не знает — и правильно делает. Но схематичный вид
 * показывает не всю модель: при включённом скрытии обёрток `$html(div)` уступает место
 * прозрачной группе ({@link './schematic-tree'}), у которой нет ни рамки, ни адреса. Курсор,
 * доехавший до такой обёртки, выглядит как несработавшая клавиша: подсветки нет, а следующая
 * стрелка считается уже от невидимого узла — то есть уводит совсем не туда, куда человек метил.
 *
 * Поэтому на невидимой цели курсор не останавливается, а идёт двумя способами по очереди:
 *
 * 1. **вглубь скрытого узла** — его дети как раз и стоят на его месте: обёртку убрали, а
 *    раскладку оставили. Направление при этом сохраняется: вниз и вправо берут первого
 *    видимого потомка, вверх и влево — последнего, потому что человек шёл к ближнему краю;
 * 2. **дальше тем же шагом** — если внутри видимых нет вовсе (пустая скрытая обёртка).
 *
 * Первое важнее второго: перепрыгнув скрытый ряд целиком, курсор пропустил бы половину формы,
 * которую человек видит на экране.
 *
 * ## Почему это не решается сокрытием обёрток из модели
 *
 * Скрытие — свойство ВИДА, а не документа: в дереве строк та же обёртка видна и выбирается,
 * и правки над ней законны. Вырезать её из модели ради одного вида значило бы завести второй
 * документ, расходящийся с первым.
 *
 * @module plugins/editor-schema/schematic/schematic-nav
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { childSlots, isNodeLike } from '@/lib/form-model/node-kind';
import { getAt, toPointer, type JsonPath } from '@/lib/form-model/paths';
import { navTarget, type NavDir } from '@/lib/form-model/query';
import { indexNodes } from '../model/node-index';
import type { NodeId } from '../host';

/**
 * Адрес следующего ВИДИМОГО узла в направлении `dir`; `null` — такого нет.
 *
 * `visible` — множество адресов, которые вид сейчас рисует ({@link schematicOrder}). Пустое
 * множество означает, что рисовать нечего, и ответ будет `null` — это законное состояние,
 * а не ошибка.
 */
export function visibleTarget(
  schema: JsonFormSchema,
  from: JsonPath,
  dir: NavDir,
  visible: ReadonlySet<NodeId>
): NodeId | null {
  const index = indexNodes(schema);
  // Посещённые пути: домен на границах слотов вправе вернуть путь, с которого шаг уже делался,
  // и без этой пометки повтор шага стал бы бесконечным.
  const seen = new Set<string>([toPointer(from)]);
  const backwards = dir === 'up' || dir === 'left';

  let path = navTarget(schema, from, dir);
  while (path !== null) {
    const key = toPointer(path);
    if (seen.has(key)) return null;
    seen.add(key);

    const id = index.idAt(path);
    if (id !== undefined && visible.has(id)) return id;

    const inside = firstVisibleInside(schema, index, path, visible, backwards);
    if (inside !== null) return inside;

    path = navTarget(schema, path, dir);
  }
  return null;
}

/**
 * Первый видимый узел ВНУТРИ поддерева — с начала или с конца.
 *
 * Обход идёт по слотам домена, а не по порядку вида: порядок вида скрытые узлы уже не
 * содержит, и по нему нельзя ответить, что лежало внутри пропущенного.
 */
function firstVisibleInside(
  schema: JsonFormSchema,
  index: ReturnType<typeof indexNodes>,
  path: JsonPath,
  visible: ReadonlySet<NodeId>,
  backwards: boolean
): NodeId | null {
  const node = getAt(schema, path);
  if (!isNodeLike(node)) return null;

  const slots = childSlots(node as JsonNode, path);
  const ordered = backwards ? [...slots].reverse() : slots;
  for (const slot of ordered) {
    const entries = backwards ? [...slot.entries].reverse() : slot.entries;
    for (const entry of entries) {
      const childPath = slot.single ? slot.path : [...slot.path, entry.index];
      const id = index.idAt(childPath);
      if (id !== undefined && visible.has(id)) return id;
      const deeper = firstVisibleInside(schema, index, childPath, visible, backwards);
      if (deeper !== null) return deeper;
    }
  }
  return null;
}
