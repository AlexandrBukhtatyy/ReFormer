/**
 * Каталог активного кита как ВНЕШНЕЕ состояние.
 *
 * Читать `host.catalog()` прямо в отрисовке недостаточно: значение живёт снаружи
 * React, и о его смене (переключили кит, догрузился ленивый каталог) компонент не узнает.
 * Отсюда `useSyncExternalStore` — тот же приём, что у остальных внешних источников
 * оболочки.
 *
 * Снимок сравнивается **по ссылке**, и это работает, потому что сервис китов отдаёт один
 * и тот же массив, пока каталог не сменился. Отдай он новый массив на каждый вызов —
 * получился бы бесконечный цикл перерисовки, поэтому свойство не случайное, а требуемое.
 *
 * @module plugins/editor-schema/ui/useCatalog
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { CatalogEntry } from '@/lib/catalog/types';
import type { SchemaEditorHost } from '../host';

export function useCatalog(host: SchemaEditorHost): readonly CatalogEntry[] {
  const subscribe = useCallback(
    (cb: () => void) => {
      const off = host.onCatalogChange(cb);
      return () => {
        off.dispose();
      };
    },
    [host]
  );
  return useSyncExternalStore(
    subscribe,
    () => host.catalog(),
    () => host.catalog()
  );
}
