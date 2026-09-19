import type { PropsSchema } from './props-schema';

/**
 * Props, общие для ВСЕХ field-компонентов кита, но потребляемые самим контролом (не враппером —
 * те живут в `fieldWrapperPropsSchema`). Подмешивается в каждую field-схему через
 * `mergeFieldPropsSchema`, поэтому варианты `tooltip` у себя НЕ объявляют.
 *
 * Объявление одно, а не в 24 `*.props.ts`: поддержка обязательна для каждого поля (страж —
 * `field-tooltip.coverage.test.tsx`), а место иконки — деталь реализации контрола, не контракта.
 *
 * React-free: файл грузится MCP-сервером в голом Node (импорт `PropsSchema` — только тип).
 */
export const fieldCommonPropsSchema: PropsSchema = {
  type: 'object',
  properties: {
    tooltip: {
      type: 'string',
      description:
        'Подсказка-тултип у иконки (i) в самом контроле: у полей ввода и селектов — внутри справа (правее крестика очистки, левее шеврона/глаза), у Checkbox/Switch — после текста, у остальных — справа от контрола.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
  },
};
