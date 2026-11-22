/**
 * Активная вкладка как React-значение.
 *
 * Тот же переходник, что `useTranslate` рядом, и заведён по той же причине: активный ресурс
 * живёт в службе документов, вне React, а панель обязана перерисоваться, когда человек
 * переключил вкладку. Без подписки панель показывала бы документ, с которого ушли.
 *
 * Отдаётся плагину контрактом, потому что до сих пор такой хук вёз КАЖДЫЙ порт
 * (`useActiveDocument` есть у генерации кода, у шаблонов, у превью) — по копии на плагин,
 * все с одинаковым телом: службы документов в SDK не было.
 *
 * Снимок — строка или `null`, то есть примитив: `useSyncExternalStore` сравнивает его
 * по ссылке, и объект здесь означал бы бесконечную перерисовку.
 *
 * @module @reformer/builder-plugin-api/ui/useActiveDocument
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { ResourceId } from '../primitives/resource.js';
import type { DocumentsService } from '../services/documents.js';

/** Служба документов в объёме хука: снимок и уведомление. */
export type ActiveDocumentSource = Pick<DocumentsService, 'activeResource' | 'onDidChange'>;

export function useActiveDocument(documents: ActiveDocumentSource): ResourceId | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = documents.onDidChange(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [documents]
  );
  const getSnapshot = useCallback(() => documents.activeResource(), [documents]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
