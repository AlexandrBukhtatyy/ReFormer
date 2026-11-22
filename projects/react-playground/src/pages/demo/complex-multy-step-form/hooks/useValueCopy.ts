/**
 * useValueCopy - хук для копирования значения из одной части формы в другую
 *
 * Инкапсулирует логику:
 * - Копирование значения источника в цель
 * - Сброс цели
 *
 * Часть формы — любая нода: поле (`FormControl`), группа (`FormGroup`) или массив (`FormArray`),
 * контракт у них общий — `FormNode`. Откуда взять ноды, решает вызывающий: из пропсов шага, из
 * контекста визарда, из строки массива.
 */

import { useCallback } from 'react';
import type { FormNode } from '@reformer/core';

interface UseValueCopyResult {
  /** Записать в цель текущее значение источника */
  copy: () => void;
  /** Вернуть цель к начальным значению и состоянию */
  reset: () => void;
}

/**
 * Хук для работы с копированием значения между нодами формы
 *
 * @typeParam TTarget - Значение цели
 * @typeParam TSource - Значение источника; должно подходить цели
 * @param source - Нода, из которой значение читается
 * @param target - Нода, в которую значение пишется
 *
 * @example Группа: адрес регистрации → адрес проживания
 * ```tsx
 * const { copy, reset } = useValueCopy(form.registrationAddress, form.residenceAddress);
 *
 * <Button onClick={copy}>Скопировать</Button>
 * <Button onClick={reset}>Очистить</Button>
 * ```
 *
 * @example Поле: основной email → дополнительный
 * ```tsx
 * const { copy } = useValueCopy(form.email, form.emailAdditional);
 * ```
 */
export function useValueCopy<TTarget, TSource extends TTarget>(
  source: FormNode<TSource>,
  target: FormNode<TTarget>
): UseValueCopyResult {
  const copy = useCallback(() => target.setValue(source.getValue()), [source, target]);
  const reset = useCallback(() => target.reset(), [target]);

  return { copy, reset };
}
