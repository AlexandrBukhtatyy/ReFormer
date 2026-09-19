import type { ChangeEvent } from 'react';
import type { FieldAdapter } from '@reformer/core';

/**
 * Переиспользуемые пресеты {@link FieldAdapter} под event-shapes shadcn-контролов.
 * У shadcn НЕТ единого `onChange` — у каждого семейства свой контракт, поэтому пресетов несколько.
 *
 * Пресет вешается на компонент статикой (`defineFieldControl(Checkbox, { adapter: checkedAdapter })`),
 * а применяет его обёртка поля — `FormField.Control` из `@reformer/cdk` или рендерер.
 */

/** Пресет с явно заданными ключами — чтобы его можно было вызывать напрямую (тесты, композиция). */
export interface KitFieldAdapter extends FieldAdapter {
  valueProp: string;
  changeProp: string;
  fromEmit: (arg: unknown, rest: Record<string, unknown>) => unknown;
  toValue: (value: unknown) => unknown;
}

/** Input / Textarea / Native Select — нативный `onChange(e)` → `e.target.value`. */
export const nativeInputAdapter: KitFieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (e) =>
    (e as ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>).target.value ||
    null,
  toValue: (v) => v ?? '',
};

/**
 * Текстовые композиты с value-based `onChange(text: string)` (Input с подсказками) — та же
 * семантика, что у {@link nativeInputAdapter}, но без события: пустой текст → `null`.
 */
export const textValueAdapter: KitFieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (v) => (v as string) || null,
  toValue: (v) => v ?? '',
};

/** Checkbox / Switch — Radix `checked` + `onCheckedChange(boolean | 'indeterminate')`. */
export const checkedAdapter: KitFieldAdapter = {
  valueProp: 'checked',
  changeProp: 'onCheckedChange',
  fromEmit: (c) => c === true, // 'indeterminate' → false
  toValue: (v) => v ?? false,
};

/** Toggle — Radix `pressed` + `onPressedChange(boolean)`. */
export const pressedAdapter: KitFieldAdapter = {
  valueProp: 'pressed',
  changeProp: 'onPressedChange',
  fromEmit: (p) => p === true,
  toValue: (v) => v ?? false,
};

/** Select / Radio Group / Toggle Group — `value` + `onValueChange(string)`. */
export const valueChangeAdapter: KitFieldAdapter = {
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
 * причине — у `fileUploadAdapter` (file-upload-base.tsx).
 *
 * `fromEmit` копирует массив: preact-сигнал бэйлится по `!==`, поэтому контрол, вернувший
 * мутированный на месте массив, подписчиков бы не уведомил — а `_dirty` при этом уже взвёлся бы.
 * Копия делает такой контрол безопасным.
 *
 * `toValue` отдаёт массив (`null` → `[]`): мульти-презентации ходят по значению `.map`/`.includes`,
 * и `''` от `valueChangeAdapter` их бы уронил.
 */
export const multiValueAdapter: KitFieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (v) => (Array.isArray(v) && v.length > 0 ? [...(v as string[])] : null),
  toValue: (v) => (Array.isArray(v) ? (v as string[]) : []),
};

/** Slider — `value: number[]` + `onValueChange(number[])`. Одно-thumb режим: берём первый. */
export const sliderAdapter: KitFieldAdapter = {
  valueProp: 'value',
  changeProp: 'onValueChange',
  fromEmit: (arr) => (arr as number[])[0] ?? null,
  toValue: (v) => [v ?? 0],
};

/** Calendar (single) — `selected` + `onSelect(Date | undefined)`. */
export const dateAdapter: KitFieldAdapter = {
  valueProp: 'selected',
  changeProp: 'onSelect',
  fromEmit: (d) => d ?? null,
  toValue: (v) => v ?? undefined,
};

/**
 * DatePicker — value-based `value: Date | undefined` + `onChange(Date | undefined)`. Контракт поля —
 * `Date | null`: `undefined` от сброса даты сворачивается в `null`, `null` на входе — в `undefined`.
 */
export const datePickerAdapter: KitFieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (d) => d ?? null,
  toValue: (v) => v ?? undefined,
};
