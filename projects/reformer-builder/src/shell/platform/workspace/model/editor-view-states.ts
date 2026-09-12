/**
 * Хранилище снимков вида редакторов — реализация объявленной возможности.
 *
 * Объявление и довод, почему хранилище общее на все редакторы, — в пакете
 * `@reformer/builder-plugin-api`.
 *
 * @module shell/platform/workspace/model/editor-view-states
 */

import type {
  EditorViewStateSlice,
  EditorViewStates,
  ResourceId,
} from '@reformer/builder-plugin-api/internal';

/**
 * Разделитель составного ключа.
 *
 * Пробел: ни в идентификаторе вклада, ни в идентификаторе ресурса (`sourceId:path`) он
 * невыразим, поэтому склейка однозначна, — а `:` был бы двусмыслен.
 */
const KEY_SEPARATOR = ' ';

export function createEditorViewStates(): EditorViewStates {
  const states = new Map<string, unknown>();
  const keyOf = (editorId: string, id: ResourceId): string => `${editorId}${KEY_SEPARATOR}${id}`;

  const slice = (editorId: string): EditorViewStateSlice => ({
    record(id, state) {
      states.set(keyOf(editorId, id), state);
    },
    peek: (id) => states.get(keyOf(editorId, id)),
    forget(id) {
      states.delete(keyOf(editorId, id));
    },
  });

  return { forEditor: slice };
}
