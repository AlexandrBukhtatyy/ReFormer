import { SliderField, sliderBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

export const sliderDocConfig: ComponentDocConfig = {
  name: 'Slider',
  importFrom: '@reformer/ui-kit',
  description:
    'Слайдер на Radix (Track / Range / Thumb, role=slider). Значение — скаляр number | null (одно-thumb режим через sliderAdapter: number → Radix [n], onValueChange → arr[0]). Диапазон и шаг задаются min/max/step. Раскладка обычная — верхнюю подпись рисует FormField.',
  variants: [
    {
      id: 'basic',
      title: 'Базовый слайдер (0–100)',
      description: 'Значение — number. Диапазон по умолчанию 0…100, шаг 1.',
      render: makeFieldVariant({
        initial: 50,
        component: SliderField,
        componentProps: { label: 'Громкость', min: 0, max: 100, step: 1 },
      }),
      code: `{
  value: model.$.volume, // initial: 50
  component: SliderField,
  componentProps: { label: 'Громкость', min: 0, max: 100, step: 1 },
}`,
    },
    {
      id: 'stepped',
      title: 'Шаг и узкий диапазон',
      description: 'min/max/step задают дискретную шкалу (напр. оценка 0…10 с шагом 2).',
      render: makeFieldVariant({
        initial: 6,
        component: SliderField,
        componentProps: { label: 'Оценка', min: 0, max: 10, step: 2 },
      }),
      code: `{
  value: model.$.rating, // initial: 6
  component: SliderField,
  componentProps: { label: 'Оценка', min: 0, max: 10, step: 2 },
}`,
    },
  ],
  examples: [
    {
      id: 'range',
      title: 'Кастомный диапазон (min/max/step)',
      description:
        'Крупная денежная шкала: min/max/step масштабируют слайдер под сумму кредита (шаг 10 000).',
      render: makeFieldVariant({
        initial: 300000,
        component: SliderField,
        componentProps: { label: 'Сумма кредита, ₽', min: 50000, max: 1000000, step: 10000 },
      }),
      code: `{
  value: model.$.amount,
  component: SliderField,
  componentProps: { label: 'Сумма кредита, ₽', min: 50000, max: 1000000, step: 10000 },
}`,
    },
  ],
  api: {
    component: SliderField,
    initialValue: 50,
    baseComponentProps: { label: 'Громкость' },
    validators: [required({ message: 'Укажите значение' })],
    valuePresets: [
      { label: 'Минимум (0)', value: 0 },
      { label: 'Середина (50)', value: 50 },
      { label: 'Максимум (100)', value: 100 },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label — задаётся baseComponentProps (иначе перетрёт initialValue undefined-ом).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(sliderBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  value: model.$.volume,
  component: SliderField,
  componentProps: {
    label: 'Громкость',
    min: ${v.min ?? 0},
    max: ${v.max ?? 100},
    step: ${v.step ?? 1},${v.required ? '\n    required: true,' : ''}
  },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.volume, [required()]);`,
  },
};
