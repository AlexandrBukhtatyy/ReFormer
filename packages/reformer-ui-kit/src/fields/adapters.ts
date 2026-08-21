import type { ChangeEvent } from 'react';
import type { FieldAdapter } from './with-form-control';

/**
 * Переиспользуемые пресеты {@link FieldAdapter} под event-shapes shadcn-контролов.
 * У shadcn НЕТ единого `onChange` — у каждого семейства свой контракт, поэтому пресетов несколько.
 */

/** Input / Textarea / Native Select — нативный `onChange(e)` → `e.target.value`. */
export const nativeInputAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (e) =>
    (e as ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>).target.value ||
    null,
  toValue: (v) => v ?? '',
};

/** Checkbox / Switch — Radix `checked` + `onCheckedChange(boolean | 'indeterminate')`. */
export const checkedAdapter: FieldAdapter = {
  valueProp: 'checked',
  changeProp: 'onCheckedChange',
  fromEmit: (c) => c === true, // 'indeterminate' → false
  toValue: (v) => v ?? false,
};

/** Toggle — Radix `pressed` + `onPressedChange(boolean)`. */
export const pressedAdapter: FieldAdapter = {
  valueProp: 'pressed',
  changeProp: 'onPressedChange',
  fromEmit: (p) => p === true,
  toValue: (v) => v ?? false,
};

/** Select / Radio Group / Toggle Group — `value` + `onValueChange(string)`. */
export const valueChangeAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onValueChange',
  fromEmit: (v) => (v as string) || null,
  toValue: (v) => v ?? '',
};

/**
 * Мультивыбор (`SelectMulti` / `ComboboxMulti` / `NativeSelectMulti` / `ToggleGroupMulti`) —
 * value-based `value: string[] | null` + `onChange(string[] | null)`.
 *
 * Пустой выбор нормализуется в `null`, а не в `[]`. Причина не косметическая: начальным значением
 * поля в модели массив быть НЕ МОЖЕТ — `createModel({ tags: [] })` строит ArrayNode, `createForm`
 * такой путь пропускает, и поля не появляется вовсе (в renderer оно при этом тихо отрендерится
 * контейнером — с подписью и опциями, но без value/onChange). Поэтому поле живёт как
 * `string[] | null`, и `required()` ловит пустой выбор без правок ядра. Тот же приём и по той же
 * причине — у `fileUploadAdapter` (file-upload-base.field.tsx).
 *
 * `fromEmit` копирует массив: preact-сигнал бэйлится по `!==`, поэтому контрол, вернувший
 * мутированный на месте массив, подписчиков бы не уведомил — а `_dirty` при этом уже взвёлся бы.
 * Копия делает такой контрол безопасным.
 *
 * `toValue` отдаёт массив (`null` → `[]`): мульти-презентации ходят по значению `.map`/`.includes`,
 * и `''` от `valueChangeAdapter` их бы уронил.
 */
export const multiValueAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (v) => (Array.isArray(v) && v.length > 0 ? [...(v as string[])] : null),
  toValue: (v) => (Array.isArray(v) ? (v as string[]) : []),
};

/** Slider — `value: number[]` + `onValueChange(number[])`. Одно-thumb режим: берём первый. */
export const sliderAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onValueChange',
  fromEmit: (arr) => (arr as number[])[0] ?? null,
  toValue: (v) => [v ?? 0],
};

/** Calendar / Date Picker — `selected` + `onSelect(Date | undefined)`. */
export const dateAdapter: FieldAdapter = {
  valueProp: 'selected',
  changeProp: 'onSelect',
  fromEmit: (d) => d ?? null,
  toValue: (v) => v ?? undefined,
};
