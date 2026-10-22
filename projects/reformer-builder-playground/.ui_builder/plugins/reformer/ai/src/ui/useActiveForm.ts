/**
 * Форма активной вкладки — для подписи «Правит: …» над полем ввода.
 *
 * Ход правит форму активной вкладки, и человек должен видеть, какую, ДО отправки запроса: иначе
 * переключение на другую форму между ходами выглядело так, будто ассистент «пишет не туда».
 *
 * Формой считается документ, текст которого разбирается как схема формы, — то же условие, по
 * которому ход берётся за вкладку. Разбор кэшируется по тексту: панель перерисовывается на каждый
 * кусок ответа модели, а документ за это время не меняется.
 *
 * @module plugins/reformer/ai/ui/useActiveForm
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { AiHost } from '../host';
import { parseSchemaText } from '../model/schema-text';

interface Cached {
  readonly text: string;
  readonly path: string | null;
}

/** Путь формы активной вкладки от корня проекта или `null`: вкладки нет, или в ней не форма. */
export function useActiveForm(host: AiHost): string | null {
  const cache = useRef<Cached | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = host.onDidChangeActive?.(onChange);
      return () => {
        subscription?.dispose();
      };
    },
    [host]
  );

  const read = useCallback((): string | null => {
    const id = host.activeResource();
    const document = id === null ? null : host.documentOf(id);
    if (document === null) return null;
    const text = document.getText();
    const known = cache.current;
    if (known !== null && known.text === text) {
      return known.path === null ? null : document.ref.path;
    }
    let path: string | null = document.ref.path;
    try {
      parseSchemaText(text);
    } catch {
      path = null;
    }
    cache.current = { text, path };
    return path;
  }, [host]);

  return useSyncExternalStore(subscribe, read);
}
