/**
 * ReFormer — операторы behavior-схемы и их контракты.
 *
 * Одиннадцать операторов декларативно описывают реактивное поведение формы:
 *   computeFrom, watchField, enableWhen, disableWhen, revalidateWhen,
 *   copyFrom, syncFields, resetWhen, transformValue, apply, applyWhen
 * Подсхему можно вынести в отдельный BehaviorSchemaFn<T> и переиспользовать через apply.
 *
 * Часть операторов в этом примере применена на разных полях ради демонстрации API —
 * в реальном коде сценарии комбинируются по необходимости.
 */
import type { BehaviorContext, BehaviorSchemaFn } from '@reformer/core';
import {
  apply,
  applyWhen,
  computeFrom,
  copyFrom,
  disableWhen,
  enableWhen,
  resetWhen,
  revalidateWhen,
  syncFields,
  transformValue,
  watchField,
} from '@reformer/core/behaviors';

type Order = {
  price: number;
  quantity: number;
  total: number;
  hasPromo: boolean;
  promoCode: string;
  email: string;
  shippingEmail: string;
  notes: string;
  notesBackup: string;
  draft: boolean;
};

// compute callback: (values: TForm) => TTarget
const computeTotal = (form: Order) => form.price * form.quantity;

// watch callback: (value, ctx: BehaviorContext<TForm>) => void | Promise<void>
const clearPromo = (on: boolean, ctx: BehaviorContext<Order>) => {
  if (!on) ctx.setFieldValue('promoCode', '');
};

// Подсхема — обычный BehaviorSchemaFn<T>: (path) => void.
// Применяется через apply к одному или нескольким полям одного типа.
const numericFieldRules: BehaviorSchemaFn<number> = (path) => {
  watchField(path, (value) => console.log('changed:', value), { immediate: false });
};
const promoRules: BehaviorSchemaFn<Order> = (path) => {
  enableWhen(path.promoCode, (form) => form.hasPromo);
};

export const orderBehavior: BehaviorSchemaFn<Order> = (path) => {
  // computeFrom — вычисляемое поле из набора источников
  computeFrom([path.price, path.quantity], path.total, computeTotal);

  // watchField — реактивный обработчик на изменение поля
  watchField(path.hasPromo, clearPromo, { immediate: false });

  // enableWhen — поле активно, пока condition(form) === true
  enableWhen(path.promoCode, (form) => form.hasPromo);

  // disableWhen — поле отключено, пока condition(form) === true (обратное enableWhen)
  disableWhen(path.notes, (form) => form.draft);

  // revalidateWhen — перевалидировать target при изменении любого из триггеров
  revalidateWhen(path.email, [path.hasPromo]);

  // copyFrom — копирует значение из source в target (опционально с when/transform)
  copyFrom(path.email, path.shippingEmail);

  // syncFields — двусторонняя синхронизация двух полей одного типа
  syncFields(path.notes, path.notesBackup);

  // resetWhen — сбрасывает поле при изменении условия (по умолчанию в initialValue)
  resetWhen(path.shippingEmail, (form) => form.draft);

  // transformValue — трансформирует значение поля (transformer: TValue => TValue)
  transformValue(path.email, (v) => v?.toLowerCase() ?? '', { onUserChangeOnly: true });

  // apply — встраивает подсхему (одно поле или массив полей одного типа)
  apply([path.price, path.quantity], numericFieldRules);

  // applyWhen — подсхема активна, пока condition(triggerValue) === true
  applyWhen(path.hasPromo, (v) => v, promoRules);
};
