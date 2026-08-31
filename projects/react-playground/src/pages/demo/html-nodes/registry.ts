/**
 * Реестр JSON-варианта мини-примера.
 *
 * Показателен своим размером: раньше каждый заголовок и инфо-плашка требовали здесь строки
 * `reg.component(...)`. С оператором `$html(...)` в реестре остаются только настоящие
 * компоненты — поле ввода и обёртка поля.
 */

import { defineRegistry, FIELD_WRAPPER, createLocaleResolver } from '@reformer/renderer-json';
import type { ComponentRegistry } from '@reformer/renderer-json';
import { InputField, FormField } from '@reformer/ui-kit';

export function createHtmlNodesRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    reg.component('Input', InputField);
    reg.component(FIELD_WRAPPER, FormField);
    // Текст html-узла принимает и `$locale(...)` — заголовок берётся из каталога.
    reg.locale(createLocaleResolver({ 'installment.title': 'Рассрочка' }));
  });
}
