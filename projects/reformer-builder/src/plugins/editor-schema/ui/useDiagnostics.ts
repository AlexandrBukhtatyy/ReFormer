/**
 * Подписка канваса на свод диагностик документа.
 *
 * Переходник `useSyncExternalStore` и ничего больше — по тому же образцу, что
 * `./useSession`: правила живут в чистых модулях, здесь остаётся три строки, в которых
 * нечему ломаться, кроме стабильности снимка.
 *
 * Про стабильность и речь: `getSnapshot` обязан отдавать ТУ ЖЕ ссылку, пока ничего не
 * менялось. Служба диагностик это гарантирует — снимок ресурса у неё кэшируется ровно
 * ради этого требования, поэтому собирать здесь свою копию не надо и НЕЛЬЗЯ: копия давала бы
 * новый массив на каждый вызов и роняла бы React в «The result of getSnapshot should be
 * cached».
 *
 * @module plugins/editor-schema/ui/useDiagnostics
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { Diagnostic, ResourceId } from '@/sdk';
import type { SchemaDiagnostics, Translate } from '../host';

/** Пустой свод: одна ссылка на все документы без находок и на случай отсутствия службы. */
const EMPTY: readonly Diagnostic[] = Object.freeze([]);

/**
 * Находки документа, с перерисовкой при их изменении.
 *
 * Подписка фильтруется по ресурсу: свод меняется у каждого открытого документа на каждой
 * его правке, и канвас, перерисовывающийся на чужие находки, платил бы за них обходом
 * своего дерева.
 */
export function useResourceDiagnostics(
  diagnostics: SchemaDiagnostics | null,
  documentId: ResourceId
): readonly Diagnostic[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (diagnostics === null) return () => undefined;
      const subscription = diagnostics.onDidChange((resource) => {
        if (resource === documentId) onStoreChange();
      });
      return () => {
        subscription.dispose();
      };
    },
    [diagnostics, documentId]
  );
  const getSnapshot = useCallback(
    () => diagnostics?.get(documentId) ?? EMPTY,
    [diagnostics, documentId]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Запасной перевод кода: сам код.
 *
 * Хук без состояния — ради того, чтобы вызов в теле компонента был БЕЗУСЛОВНЫМ. Порт
 * композиции вправе не давать словарь Host (`useDiagnosticMessage` необязателен), а
 * вызывать хук по условию нельзя: подстановка запасного и есть способ этого избежать.
 */
export function useDiagnosticCode(): Translate {
  return (code) => code;
}
