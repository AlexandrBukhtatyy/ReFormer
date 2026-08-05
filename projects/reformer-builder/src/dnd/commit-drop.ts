/**
 * Коммит дропа — общий для схематичного canvas и runtime-превью: payload из {@link getDrag} →
 * мутация {@link performDrop} → применение к активной вкладке (выделение переезжает на `newPath`).
 *
 * @module reformer-builder/dnd/commit-drop
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { JsonPath } from '../model';
import { editorActions } from '../store';
import { clearDrag, getDrag } from './drag-state';
import { performDrop, type DropZone } from './resolve-drop';

/** Выполнить дроп на узел `path` в зону `zone`. Без активного payload — no-op. */
export function commitDrop(schema: JsonFormSchema, path: JsonPath, zone: DropZone): void {
  const payload = getDrag();
  clearDrag();
  if (!payload) return;
  const res = performDrop(schema, path, zone, payload);
  if (res) editorActions.commit(res);
}
