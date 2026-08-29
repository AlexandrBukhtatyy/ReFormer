/**
 * Переиспользуемые фрагменты `inputSchema` write-инструментов.
 *
 * Вынесены, чтобы адрес узла и ожидание описывались одинаково во всех инструментах: модель учит
 * один словарь, а не восемь похожих.
 *
 * @module plugins/ai/core/tools/params
 */

import type { NodeExpectation } from '../node-ref';

/**
 * Свойство `ref` — адрес узла.
 *
 * Описание короткое намеренно: формат адреса объяснён в системном промпте один раз, а этот фрагмент
 * инлайнится в семь инструментов и уходит в запрос на каждом шаге хода. Повторять там определение
 * JSON Pointer — платить за одно и то же объяснение семь раз, десятки раз за ход.
 */
export const REF_PROP = {
  type: 'string',
  description: 'Node address from get_form_outline',
} as const;

/**
 * Свойство `expect` — страховка от съехавшего адреса. Указатель может устареть, если форму
 * изменили между чтением карты и правкой; сверка компонента/модели превращает тихую правку
 * чужого узла в честную ошибку.
 *
 * Ключи оставлены без собственных описаний: `component` и `model` называют себя сами, а фрагмент
 * инлайнится в шесть инструментов. Единственное, что не выводится из имён, — смысл `null`, и он
 * поднят в общее описание, то есть стал заметнее, а не тише.
 */
export const EXPECT_PROP = {
  type: 'object',
  description: 'Expected component/model at ref; null skips. Mismatch rejected',
  properties: {
    // `null` допустим наравне со строкой: модели заполняют объект целиком и ставят null там, где
    // проверять нечего (у контейнера нет модели). Отвергать такой вызов — значит тратить шаг хода
    // на форму записи, а не на смысл; `resolveRef` сверяет ожидание по truthy, поэтому null для
    // него — то же самое, что отсутствующий ключ.
    component: { type: ['string', 'null'] },
    model: { type: ['string', 'null'] },
  },
  additionalProperties: false,
} as const;

/**
 * Свойства раскладки — общие у `set_layout` и `group_nodes`.
 *
 * Оба инструмента задают раскладку контейнера, только один существующего, другой создаваемого.
 * Пока словарь был скопирован, две одинаковые тройки описаний уходили в каждый запрос порознь.
 */
export const LAYOUT_PROPS = {
  direction: { type: 'string', enum: ['row', 'column'], description: 'Layout axis' },
  columns: { type: 'integer', minimum: 2, description: 'Grid columns' },
  gap: {
    type: 'string',
    enum: ['none', 'sm', 'md', 'lg'],
    description: 'Spacing between children',
  },
} as const;

/** Аргументы, адресующие один узел. */
export interface RefParams {
  ref: string;
  expect?: NodeExpectation;
}
