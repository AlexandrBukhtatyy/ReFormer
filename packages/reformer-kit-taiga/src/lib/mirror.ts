/**
 * Зеркало поля ReFormer в `FormControl` Angular.
 *
 * Флажок, переключатель, радиокнопка и список Taiga UI без `NgControl` не работают: флажок и
 * радиокнопка принудительно выключены, список не создаётся. Состояние поля при этом остаётся в ядре,
 * а зеркало — только провод: значение, `disabled`, признак ошибки и «тронутость» идут из поля в
 * `FormControl`, значение и «тронутость» от виджета — обратно в поле.
 */
import type { DestroyRef } from '@angular/core';
import {
  FormControl as AngularFormControl,
  TouchedChangeEvent,
  type ValidationErrors,
} from '@angular/forms';
import type { FormControl } from '@reformer/core';
import { effect } from '@reformer/core/signals';

/**
 * `FormControl`, который повторяет поле формы. Правил проверки у зеркала нет: ошибку считает ядро,
 * зеркало лишь сообщает виджету, что её пора показать. Записи зеркала рассылают события
 * `FormControl` — Taiga UI перерисовывает виджет по ним.
 *
 * @param field - Поле формы ReFormer.
 * @param destroyRef - Владелец подписок.
 */
export function mirrorControl<T>(
  field: FormControl<T>,
  destroyRef: DestroyRef
): AngularFormControl<T> {
  const validator = (): ValidationErrors | null =>
    field.shouldShowError.peek() ? { reformer: true } : null;
  const control = new AngularFormControl<T>(field.value.peek(), {
    nonNullable: true,
    validators: validator,
  });

  // Пока зеркало само пишет в `FormControl`, его события — эхо, а не действие пользователя.
  let applying = false;
  const apply = (write: () => void): void => {
    applying = true;
    try {
      write();
    } finally {
      applying = false;
    }
  };

  const stopValue = effect(() => {
    const value = field.value.value;
    if (!Object.is(control.value, value)) apply(() => control.setValue(value));
  });
  const stopDisabled = effect(() => {
    const disabled = field.disabled.value;
    if (disabled !== control.disabled) {
      apply(() => (disabled ? control.disable() : control.enable()));
    }
  });
  const stopError = effect(() => {
    const showError = field.shouldShowError.value;
    const touched = field.touched.value || showError;
    apply(() => {
      if (touched !== control.touched) {
        if (touched) control.markAsTouched();
        else control.markAsUntouched();
      }
      control.updateValueAndValidity();
    });
  });

  const fromWidget = control.events.subscribe((event) => {
    if (applying) return;
    if (event instanceof TouchedChangeEvent && event.touched && !field.touched.peek()) {
      field.markAsTouched();
    }
  });
  const fromValue = control.valueChanges.subscribe((value) => {
    if (applying || Object.is(field.value.peek(), value)) return;
    field.setValue(value);
  });

  destroyRef.onDestroy(() => {
    stopValue();
    stopDisabled();
    stopError();
    fromWidget.unsubscribe();
    fromValue.unsubscribe();
  });
  return control;
}
