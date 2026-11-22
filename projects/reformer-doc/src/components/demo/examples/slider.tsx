import { Slider, sliderBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, min } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

// Пропсы панели API — из props-схемы варианта. label задаётся baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(sliderBasePropsSchema), {
  omit: ['label'],
});

export const sliderDocConfig: ComponentDocConfig = {
  name: 'Slider',
  importFrom: '@reformer/ui-kit',
  description:
    'Ползунок для числа из диапазона. Значение поля — number | null, диапазон и шаг — min, max, step.',
  variants: [
    fieldVariant({
      id: 'basic',
      title: 'Диапазон по умолчанию',
      description: 'Без min/max/step — шкала 0…100 с шагом 1.',
      field: 'volume',
      component: Slider,
      componentName: 'Slider',
      initial: 50,
      showInitial: true,
      props: { label: 'Громкость' },
    }),
    fieldVariant({
      id: 'stepped',
      title: 'Шаг и узкий диапазон',
      description: 'min, max и step задают дискретную шкалу: оценка 0…10 с шагом 2.',
      field: 'rating',
      component: Slider,
      componentName: 'Slider',
      initial: 6,
      showInitial: true,
      props: { label: 'Оценка', min: 0, max: 10, step: 2 },
    }),
  ],
  examples: [
    fieldVariant({
      id: 'amount',
      title: 'Сумма кредита',
      description:
        'Крупная денежная шкала с шагом 10 000. Подпись не показывает текущее число — выводите его рядом сами или берите InputNumber.',
      field: 'amount',
      component: Slider,
      componentName: 'Slider',
      initial: 300000,
      showInitial: true,
      props: { label: 'Сумма кредита, ₽', min: 50000, max: 1000000, step: 10000 },
    }),
    fieldVariant({
      id: 'validation',
      title: 'Правило min',
      description:
        'Слайдер сам держит значение в границах min…max. Правило нужно, когда допустимый порог строже шкалы: здесь — не меньше 3.',
      field: 'rating',
      component: Slider,
      componentName: 'Slider',
      initial: 1,
      showInitial: true,
      props: { label: 'Оценка', min: 0, max: 10, step: 1 },
      validators: [min(3, { code: 'rating.min' })],
      rules: "min(3, { code: 'rating.min' })",
      messages: { 'rating.min': 'Оценка не ниже 3' },
      touched: true,
    }),
  ],
  api: {
    component: Slider,
    initialValue: 50,
    baseComponentProps: { label: 'Громкость' },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Укажите значение' },
    valuePresets: [
      { label: 'Минимум (0)', value: 0 },
      { label: 'Середина (50)', value: 50 },
      { label: 'Максимум (100)', value: 100 },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'volume',
        component: 'Slider',
        props: { label: 'Громкость' },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
