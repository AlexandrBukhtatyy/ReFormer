/**
 * Переиспользуемые фрагменты `inputSchema` write-инструментов.
 *
 * Вынесены, чтобы адрес узла и ожидание описывались одинаково во всех инструментах: модель учит
 * один словарь, а не восемь похожих.
 *
 * @module reformer-builder/agent/core/tools/params
 */

import type { NodeExpectation } from '../node-ref';

/** Свойство `ref` — адрес узла. */
export const REF_PROP = {
  type: 'string',
  description: 'JSON Pointer узла из get_form_outline, например /root/children/0',
} as const;

/**
 * Свойство `expect` — страховка от съехавшего адреса. Указатель может устареть, если форму
 * изменили между чтением карты и правкой; сверка компонента/модели превращает тихую правку
 * чужого узла в честную ошибку.
 */
export const EXPECT_PROP = {
  type: 'object',
  description: 'Что ожидается по адресу; при несовпадении правка отклоняется',
  properties: {
    component: { type: 'string', description: 'Ожидаемое имя компонента' },
    model: { type: 'string', description: 'Ожидаемый путь модели без $model(...)' },
  },
  additionalProperties: false,
} as const;

/** Аргументы, адресующие один узел. */
export interface RefParams {
  ref: string;
  expect?: NodeExpectation;
}
