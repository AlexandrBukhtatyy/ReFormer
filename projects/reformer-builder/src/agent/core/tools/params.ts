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
  description: 'JSON Pointer of a node as shown by get_form_outline, e.g. /root/children/0',
} as const;

/**
 * Свойство `expect` — страховка от съехавшего адреса. Указатель может устареть, если форму
 * изменили между чтением карты и правкой; сверка компонента/модели превращает тихую правку
 * чужого узла в честную ошибку.
 */
export const EXPECT_PROP = {
  type: 'object',
  description: 'What you expect to find at the address; the edit is rejected on a mismatch',
  properties: {
    // `null` допустим наравне со строкой: модели заполняют объект целиком и ставят null там, где
    // проверять нечего (у контейнера нет модели). Отвергать такой вызов — значит тратить шаг хода
    // на форму записи, а не на смысл; `resolveRef` сверяет ожидание по truthy, поэтому null для
    // него — то же самое, что отсутствующий ключ.
    component: { type: ['string', 'null'], description: 'Expected component name' },
    model: { type: ['string', 'null'], description: 'Expected model path without $model(...)' },
  },
  additionalProperties: false,
} as const;

/** Аргументы, адресующие один узел. */
export interface RefParams {
  ref: string;
  expect?: NodeExpectation;
}
