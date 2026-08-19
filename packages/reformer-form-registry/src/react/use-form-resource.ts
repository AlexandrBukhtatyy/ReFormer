/**
 * Загрузка частей формы с защитой от гонок.
 *
 * Приём двойной защиты взят из `useAsyncResource` в `@reformer/cdk`: `AbortController`
 * плюс локальный флаг `cancelled`. Одного контроллера мало — ответ предыдущей записи может
 * прийти уже после старта загрузки следующей, и без флага он бы перезаписал свежее состояние.
 *
 * @module reformer/form-registry/react/use-form-resource
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRegistry } from '@reformer/renderer-json';
import type { FormEntry } from '../types';
import { entryKeyOf, loadForm, type LoadFormOptions, type LoadedForm } from '../loader';

export type FormResource<T extends object> =
  | { status: 'pending' }
  | { status: 'ready'; data: LoadedForm<T> }
  | { status: 'error'; error: Error; retry: () => void };

/**
 * Что можно донести до загрузчика с места монтирования.
 *
 * `signal` сюда НЕ входит, и это не упущение: отмена на связке «кэш + StrictMode» ломает загрузку.
 * React монтирует, размонтирует и монтирует снова синхронно, в одном коммите; отмена по уходу
 * последнего ждущего гасит общий запрос, а второй монтаж успевает присоединиться к нему до того,
 * как `.finally` уберёт ключ из `inFlight`, — и получает вечную ошибку без шанса на автоповтор.
 * Сценарий закреплён тестом в `cache.test.ts` и заведён отдельной задачей.
 */
export type UseFormResourceOptions = Pick<
  LoadFormOptions,
  'cache' | 'preflight' | 'onDiagnostic' | 'fetchImpl'
>;

export function useFormResource<T extends object>(
  entry: FormEntry<T>,
  baseRegistry: ComponentRegistry,
  opts?: UseFormResourceOptions
): FormResource<T> {
  const [state, setState] = useState<{
    status: 'pending' | 'ready' | 'error';
    data?: LoadedForm<T>;
    error?: Error;
  }>({
    status: 'pending',
  });
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  // Ключ, а не сам объект: запись пересоздаётся при каждом рендере хоста,
  // и сравнение по ссылке гоняло бы загрузку бесконечно.
  const key = entryKeyOf(entry);
  const entryRef = useRef(entry);
  entryRef.current = entry;

  // Опции — тем же приёмом, что и запись: колбэки и литералы хоста нестабильны по ссылке, а
  // перезагружать форму из-за нового `onDiagnostic` бессмысленно. В зависимости попадает только
  // `cache`: смена ЭКЗЕМПЛЯРА кэша (другой `maxAgeMs`, другое хранилище) — это уже другая
  // загрузка, и она обязана произойти заново.
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const cache = opts?.cache;

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'pending' });

    loadForm(entryRef.current, baseRegistry, optsRef.current).then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [key, baseRegistry, cache, nonce]);

  if (state.status === 'ready' && state.data) return { status: 'ready', data: state.data };
  if (state.status === 'error' && state.error)
    return { status: 'error', error: state.error, retry };
  return { status: 'pending' };
}
