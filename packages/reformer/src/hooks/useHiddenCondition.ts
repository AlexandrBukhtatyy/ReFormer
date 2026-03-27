/**
 * useHiddenCondition - хук для реактивной проверки условия hidden
 *
 * Подписывается на изменения формы и пересчитывает условие hidden.
 *
 * @module hooks/useHiddenCondition
 */

import { useSyncExternalStore, useCallback } from 'react';
import type { FormProxy, FieldPath } from '../core/types';

type HiddenFn<T> = (form: FormProxy<T>, path: FieldPath<T>) => boolean;

/**
 * Хук для реактивной оценки функции hidden
 *
 * Подписывается на изменения формы через сигналы и
 * возвращает текущее значение hidden условия.
 *
 * @param hiddenFn - Функция, определяющая скрытие
 * @param form - FormProxy формы
 * @param path - Текущий FieldPath
 * @returns true если элемент должен быть скрыт
 */
export function useHiddenCondition<T>(
  hiddenFn: HiddenFn<T> | undefined,
  form: FormProxy<T>,
  path: FieldPath<T>
): boolean {
  // Если нет функции hidden - элемент всегда видим
  if (!hiddenFn) {
    return false;
  }

  // Создаём функцию подписки на все сигналы формы
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // Получаем доступ к внутреннему состоянию формы
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formAny = form as any;

      // Собираем все сигналы значений полей для подписки
      const unsubscribes: (() => void)[] = [];

      // Подписываемся на изменения всех полей первого уровня
      for (const key of Object.keys(formAny)) {
        const field = formAny[key];
        if (
          field &&
          typeof field === 'object' &&
          field.value &&
          typeof field.value.subscribe === 'function'
        ) {
          const unsubscribe = field.value.subscribe(onStoreChange);
          unsubscribes.push(unsubscribe);
        }
      }

      return () => {
        unsubscribes.forEach((unsub) => unsub());
      };
    },
    [form]
  );

  // Функция получения текущего состояния (hidden значения)
  const getSnapshot = useCallback(() => {
    return hiddenFn(form, path);
  }, [hiddenFn, form, path]);

  // Используем useSyncExternalStore для синхронизации с React
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
