/**
 * Диалекты нейтральных примитивов для ReFormer: статика `reformerAdapter` на самом компоненте
 * (документированный способ, `@reformer/core/react` → `FieldAdapter`). Отдельных «field-версий»
 * компонентов нет — в схеме поля лежит сам примитив.
 *
 * Примитивы — нативные элементы с `ref`, поэтому привязка неуправляемая (`uncontrolled: true`):
 * значение поля пишется прямо в DOM-элемент, и ввод не перерисовывает поле (`Field.tsx` значение
 * при рендере не читает). Рендерер JSON-варианта нода в seam не передаёт — у него привязка прежняя,
 * управляемая.
 *
 * Статика ставится побочным эффектом этого модуля; страницы собираются по отдельности, поэтому
 * примитивы других библиотек её не видят. Адаптер числа — в `credit/number-input.ts`: он берёт
 * общий разбор числа из домена кредита, а код кредита не должен попадать в бандл регистрации.
 */
import type { ChangeEvent } from 'react';
import type { FieldAdapter } from '@reformer/core/react';
import {
  Checkbox,
  DateInput,
  MaskedInput,
  RadioGroup,
  Select,
  TextInput,
  Textarea,
} from '../../shared/ui/controls';

type ElementEvent = ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

/** DOM-событие `onChange` → строка; `null`/`undefined` → пустая строка. */
export const valueEventAdapter: FieldAdapter = {
  uncontrolled: true,
  fromEmit: (e) => (e as ElementEvent).target.value,
  toValue: (v) => v ?? '',
};

/** Чекбокс: `checked` + DOM-событие. */
export const checkedEventAdapter: FieldAdapter = {
  uncontrolled: true,
  valueProp: 'checked',
  fromEmit: (e) => (e as ChangeEvent<HTMLInputElement>).target.checked,
  toValue: (v) => Boolean(v),
};

// Дата и радиогруппа — тоже `value` + DOM-событие со строкой в `target.value`.
for (const component of [TextInput, MaskedInput, Select, Textarea, DateInput, RadioGroup]) {
  Object.assign(component, { reformerAdapter: valueEventAdapter });
}
Object.assign(Checkbox, { reformerAdapter: checkedEventAdapter });
