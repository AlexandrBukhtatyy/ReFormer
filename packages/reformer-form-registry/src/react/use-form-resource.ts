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
import { entryKeyOf, loadForm, type LoadedForm } from '../loader';

export type FormResource<T extends object> =
  | { status: 'pending' }
  | { status: 'ready'; data: LoadedForm<T> }
  | { status: 'error'; error: Error; retry: () => void };

export function useFormResource<T extends object>(
  entry: FormEntry<T>,
  baseRegistry: ComponentRegistry
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

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'pending' });

    loadForm(entryRef.current, baseRegistry).then(
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
  }, [key, baseRegistry, nonce]);

  if (state.status === 'ready' && state.data) return { status: 'ready', data: state.data };
  if (state.status === 'error' && state.error)
    return { status: 'error', error: state.error, retry };
  return { status: 'pending' };
}
