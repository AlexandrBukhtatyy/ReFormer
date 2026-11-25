/**
 * Общее для полей кита на Vuetify: testid, текст ошибки, общие пропсы.
 *
 * Поле Vuetify — самодостаточное: подпись и ошибку рисует сам компонент библиотеки. Обёртки поля у
 * кита нет, поэтому роли `field-`, `label-`, `input-` и `error-{testId}` контрол расставляет сам —
 * так же, как их ставят поле и контролы `@reformer/ui-kit`.
 */
import { h, type Directive, type PropType, type VNodeChild } from 'vue';
import type { FormControl } from '@reformer/core';

/** Пункт списка или группы радиокнопок — как его задаёт схема формы. */
export interface Option {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
}

const INPUT_PREFIX = 'input-';

/**
 * Контрол рисует поле целиком: рендерер отдаёт ему подпись (`reformerLayout`) и ноду поля
 * (`reformerNeedsControl`), из которой берётся текст показанной ошибки.
 */
export function selfSufficient<C extends object>(component: C): C {
  return Object.assign(component, {
    reformerLayout: 'inline-label',
    reformerNeedsControl: true,
  });
}

/**
 * Проп ноды поля. Тип назван: компоненты разворачивают `fieldProps` в свои пропсы, и без имени
 * объявление каждого печатало бы путь до `FormControl` само — от `baseUrl` сборки, который у
 * потребителя не резолвится.
 */
export interface ControlProp {
  type: PropType<FormControl<unknown>>;
  required: true;
}

/** Пропсы любого поля кита. */
export const fieldProps = {
  /** Значение поля — диалект `v-model`. */
  modelValue: { type: null as unknown as PropType<unknown>, default: undefined },
  /** Нода поля: источник текста ошибки. */
  control: { type: Object as PropType<FormControl<unknown>>, required: true } as ControlProp,
  label: { type: String, default: undefined },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /** Подсказка поля из схемы: у полей Vuetify ей места нет, проп объявлен, чтобы не лечь атрибутом. */
  tooltip: { type: String, default: undefined },
};

export type FieldEvent = 'update:modelValue' | 'blur';
export type FieldEmit = (event: FieldEvent, ...args: unknown[]) => void;

export const fieldEmits: FieldEvent[] = ['update:modelValue', 'blur'];

/** Подпись с пометкой обязательного поля. */
export const labelText = (label: string | undefined, required: boolean): string | undefined =>
  label && required ? `${label} *` : label;

/**
 * Идентификатор поля в testid. Рендерер отдаёт контролу `data-testid="input-{id}"`: `id` — явный
 * `testId` из схемы либо путь поля через дефис. Остальные роли строятся из него же.
 */
export function fieldIdOf(attrs: Record<string, unknown>): string | undefined {
  const testId = attrs['data-testid'];
  return typeof testId === 'string' && testId.startsWith(INPUT_PREFIX)
    ? testId.slice(INPUT_PREFIX.length)
    : undefined;
}

/** Атрибуты контрола без `data-testid`: его кит раскладывает по элементам сам. */
export function withoutTestId(attrs: Record<string, unknown>): Record<string, unknown> {
  const { 'data-testid': _testId, ...rest } = attrs;
  return rest;
}

function mark(element: Element | null, testId: string | undefined): void {
  if (!element) return;
  if (testId === undefined) element.removeAttribute('data-testid');
  else if (element.getAttribute('data-testid') !== testId) {
    element.setAttribute('data-testid', testId);
  }
}

/**
 * Нативный элемент поля Vuetify. У списка перед ним стоят скрытые `<input type="hidden">` — по
 * одному на выбранное значение: они нужны отправке формы браузером, а не вводу.
 */
const NATIVE_CONTROL = 'input:not([type="hidden"]), textarea';

function markField(root: HTMLElement, id: string | undefined): void {
  mark(root.querySelector(NATIVE_CONTROL), id && `${INPUT_PREFIX}${id}`);
  // У поля с плавающей подписью подписей две: вторая — копия для анимации, она скрыта от
  // вспомогательных технологий и ролью подписи не помечается.
  mark(root.querySelector('label.v-label:not(.v-field-label--floating)'), id && `label-${id}`);
}

/**
 * `input-{id}` — на нативный элемент внутри поля Vuetify, `label-{id}` — на его подпись.
 *
 * `data-*`, переданный компоненту Vuetify, остаётся на его корне, а тестам и автоматизации нужен
 * сам `<input>`. Значение директивы — идентификатор поля.
 */
export const vFieldTestIds: Directive<HTMLElement, string | undefined> = {
  mounted: (root, binding) => markField(root, binding.value),
  updated: (root, binding) => markField(root, binding.value),
};

/**
 * Значение поля — атрибутом `data-value` на нативном элементе. Нужно списку: в его поле ввода стоит
 * подпись выбранного пункта, а не значение.
 */
export const vFieldValue: Directive<HTMLElement, string> = {
  mounted: (root, binding) =>
    root.querySelector(NATIVE_CONTROL)?.setAttribute('data-value', binding.value),
  updated: (root, binding) =>
    root.querySelector(NATIVE_CONTROL)?.setAttribute('data-value', binding.value),
};

function markRadioGroup(root: HTMLElement, id: string | undefined): void {
  mark(root.querySelector('[role="radiogroup"]'), id && `${INPUT_PREFIX}${id}`);
  // Подпись группы — первый элемент блока контрола; подписи опций лежат глубже, у своих кнопок.
  mark(root.querySelector(':scope > .v-input__control > .v-label'), id && `label-${id}`);
}

/**
 * Группа радиокнопок: `input-{id}` — на элемент группы, `label-{id}` — на подпись группы. Сами
 * кнопки помечает `vFieldTestIds` с идентификатором `{id}-{значение}`.
 */
export const vRadioGroupTestIds: Directive<HTMLElement, string | undefined> = {
  mounted: (root, binding) => markRadioGroup(root, binding.value),
  updated: (root, binding) => markRadioGroup(root, binding.value),
};

/**
 * Слот `message` поля Vuetify: текст ошибки в элементе `error-{id}`. Слот рисуется только для
 * показанного сообщения — без ошибки элемента в разметке нет.
 */
export function errorSlot(id: string | undefined) {
  return ({ message }: { message: string }): VNodeChild =>
    h('span', { 'data-testid': id && `error-${id}` }, message);
}

/** Сообщения поля для `error-messages`: текст показанного замечания либо ничего. */
export const errorMessages = (error: string | undefined): string[] => (error ? [error] : []);
