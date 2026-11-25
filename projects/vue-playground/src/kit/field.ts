/**
 * Общее для полей кита на Vuetify: testid DOM-контракта и текст ошибки.
 *
 * Поле Vuetify — самодостаточное: подпись и ошибку рисует сам компонент библиотеки. Обёртки поля
 * у кита нет, поэтому роли `field-`, `label-`, `input-` и `error-{путь}` контрол расставляет сам.
 */
import { h, type Directive, type VNodeChild } from 'vue';

const INPUT_PREFIX = 'input-';

/**
 * Идентификатор поля в testid. Рендерер отдаёт контролу `data-testid="input-{id}"`: `id` — путь
 * поля через дефис либо явный `testId` из схемы. Остальные роли строятся из него же.
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
 * `data-*`, переданный компоненту Vuetify, остаётся на его корне, а сценарии печатают в поле и
 * читают значение по `input-{id}`: им нужен сам `<input>`. Значение директивы — идентификатор поля.
 */
export const vFieldTestIds: Directive<HTMLElement, string | undefined> = {
  mounted: (root, binding) => markField(root, binding.value),
  updated: (root, binding) => markField(root, binding.value),
};

/**
 * Значение поля — атрибутом `data-value` на нативном элементе. Нужно списку: в его поле ввода
 * стоит подпись выбранного пункта, а сценарии сверяют значение.
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
