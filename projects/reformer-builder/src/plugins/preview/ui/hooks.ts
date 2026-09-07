/**
 * Подписки React на контекст превью и на его состояние.
 *
 * Отдельно от поверхностей по той же причине, по которой у редактора схемы отделён `useSession`:
 * правила живут в чистых модулях, а здесь остаётся переходник `useSyncExternalStore`, в котором
 * нечему ломаться, кроме стабильности снимка.
 *
 * Про стабильность и речь: `getSnapshot` обязан возвращать ту же ссылку, пока ничего
 * не изменилось, иначе React падает с «The result of getSnapshot should be cached». Поэтому
 * контекст кэширует разобранную схему, а состояние отдаёт замороженный снимок.
 *
 * @module plugins/preview/ui/hooks
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { NodeId } from '@/sdk';
import type { PreviewContext } from '../contract';
import type { PreviewHost } from '../host';

/** Схема документа с перерисовкой на каждую правку буфера. */
export function usePreviewSchema(ctx: PreviewContext): JsonFormSchema | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = ctx.onDidChangeSchema(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [ctx]
  );
  const snapshot = useCallback(() => ctx.schema(), [ctx]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Выделение с перерисовкой на его смену. */
export function usePreviewSelection(ctx: PreviewContext): readonly NodeId[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = ctx.onDidChangeSelection(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [ctx]
  );
  const snapshot = useCallback(() => ctx.selection(), [ctx]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Счётчик смен активного кита.
 *
 * Нужен ровно затем, чтобы пересобрать реестр компонентов: каталог и namespace приходят
 * функциями порта, и без подписки превью осталось бы с китом, который был активен в момент
 * первой сборки. `useState`, а не `useSyncExternalStore`: снимка здесь нет вовсе — есть
 * событие «пересоберись», и счётчик выражает его точнее, чем выдуманное значение.
 */
export function useKitVersion(host: Pick<PreviewHost, 'onDidChangeKit'>): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const subscription = host.onDidChangeKit(() => {
      setVersion((previous) => previous + 1);
    });
    return () => {
      subscription.dispose();
    };
  }, [host]);
  return version;
}

/**
 * Счётчик правок рабочих копий.
 *
 * Отдельно от подписки на документ схемы: сайдкары формы правят в соседних вкладках, и
 * `onDidChangeContent` про них ничего не знает. Порт вправе такого канала не дать — тогда
 * счётчик остаётся нулём, и компиляция пересобирается только на смене схемы.
 */
export function useFilesVersion(host: Pick<PreviewHost, 'onDidChangeFiles'>): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const subscription = host.onDidChangeFiles?.(() => {
      setVersion((previous) => previous + 1);
    });
    return () => {
      subscription?.dispose();
    };
  }, [host]);
  return version;
}
