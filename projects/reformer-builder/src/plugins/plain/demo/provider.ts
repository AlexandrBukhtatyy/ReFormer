/**
 * Провайдер модели демо-стека: разбор, печать и правка `plain-form/1`.
 *
 * Берётся за документ по СОДЕРЖИМОМУ, а не по расширению: `.json` бывает схемой любого стека,
 * и отличает их только `$schema`. Проба дешёвая — регулярное выражение по уже прочитанному
 * тексту, без разбора JSON.
 *
 * @module plugins/plain/demo/provider
 */

import {
  applyPlainOp,
  looksLikePlainForm,
  parsePlainForm,
  printPlainForm,
  type PlainForm,
  type PlainOp,
} from '@reformer/builder-stack-plain';
import type {
  DocumentModelProvider,
  EditOp,
  EditorProbe,
  ResourceRef,
} from '@reformer/builder-plugin-api';
import { PLAIN_PROVIDER_ID } from './contract';

/** Текст из пробы, если оболочка положила его синхронно (`peek`), иначе `null`. */
function peekText(probe: EditorProbe): string | null {
  const peek = (probe as { peek?: () => string | null }).peek;
  return typeof peek === 'function' ? peek() : null;
}

/** Документ ли стека — общий ответ провайдера и редактора: два ответа разошлись бы. */
export function isPlainResource(ref: ResourceRef, probe: EditorProbe): boolean {
  if (!ref.mediaType.includes('json')) return false;
  const text = peekText(probe);
  return text !== null && looksLikePlainForm(text);
}

export function createPlainModelProvider(): DocumentModelProvider<PlainForm> {
  return {
    id: PLAIN_PROVIDER_ID,
    applies: isPlainResource,
    parse: parsePlainForm,
    print: printPlainForm,
    // Словарь операций — стека: платформа передаёт `{ type, params }` как есть.
    apply: (model, op: EditOp) => applyPlainOp(model, op as unknown as PlainOp),
  };
}
