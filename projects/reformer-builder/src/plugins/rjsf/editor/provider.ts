/**
 * Провайдер модели домена RJSF: разбор, печать и правка `rjsf-form/1`.
 *
 * Берётся за документ по СОДЕРЖИМОМУ, а не по расширению: `.json` бывает схемой любого стека,
 * и отличает их только `$schema`. Проба дешёвая — регулярное выражение по уже прочитанному
 * тексту, без разбора JSON.
 *
 * @module plugins/rjsf/editor/provider
 */

import {
  applyRjsfOp,
  looksLikeRjsfForm,
  parseRjsfForm,
  printRjsfForm,
  RJSF_PROVIDER_ID,
  type RjsfForm,
  type RjsfOp,
} from '@/plugins/rjsf/core';
import type {
  DocumentModelProvider,
  EditOp,
  EditorProbe,
  ResourceRef,
} from '@reformer/builder-plugin-api';

/** Текст из пробы, если оболочка положила его синхронно (`peek`), иначе `null`. */
function peekText(probe: EditorProbe): string | null {
  const peek = (probe as { peek?: () => string | null }).peek;
  return typeof peek === 'function' ? peek() : null;
}

/** Документ ли домена — общий ответ провайдера и редактора: два ответа разошлись бы. */
export function isRjsfResource(ref: ResourceRef, probe: EditorProbe): boolean {
  if (!ref.mediaType.includes('json')) return false;
  const text = peekText(probe);
  return text !== null && looksLikeRjsfForm(text);
}

export function createRjsfModelProvider(): DocumentModelProvider<RjsfForm> {
  return {
    id: RJSF_PROVIDER_ID,
    applies: isRjsfResource,
    parse: parseRjsfForm,
    print: printRjsfForm,
    // Словарь операций — домена: платформа передаёт `{ type, params }` как есть.
    apply: (model, op: EditOp) => applyRjsfOp(model, op as unknown as RjsfOp),
  };
}
