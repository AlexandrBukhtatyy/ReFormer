import { CheckboxField, checkboxBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

export const checkboxDocConfig: ComponentDocConfig = {
  name: 'Checkbox',
  importFrom: '@reformer/ui-kit',
  description:
    'Чекбокс на Radix (button role=checkbox + CheckIcon). Значение — boolean. Inline-раскладка: подпись рисуется справа от контрола, поэтому FormField верхнюю подпись не дублирует.',
  variants: [
    {
      id: 'consent',
      title: 'Согласие (подпись справа)',
      description:
        'Значение — boolean. Подпись из componentProps.label рендерится справа от чекбокса.',
      render: makeFieldVariant({
        initial: false,
        component: CheckboxField,
        componentProps: { label: 'Согласен с условиями обработки данных' },
      }),
      code: `{
  value: model.$.agree,
  component: CheckboxField,
  componentProps: { label: 'Согласен с условиями обработки данных' },
}`,
    },
    {
      id: 'checked',
      title: 'Предустановленное значение',
      description: 'initial: true — чекбокс отмечен на маунте.',
      render: makeFieldVariant({
        initial: true,
        component: CheckboxField,
        componentProps: { label: 'Получать уведомления' },
      }),
      code: `{
  value: model.$.subscribe, // initial: true
  component: CheckboxField,
  componentProps: { label: 'Получать уведомления' },
}`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Обязательное согласие (валидатор required)',
      description:
        'required() для boolean требует значение true. touched-поле со снятым чекбоксом показывает ошибку.',
      render: makeFieldVariant({
        initial: false,
        component: CheckboxField,
        componentProps: { label: 'Принимаю оферту' },
        validators: [required({ message: 'Необходимо принять условия' })],
        touched: true,
      }),
      code: `{
  value: model.$.acceptTerms,
  component: CheckboxField,
  componentProps: { label: 'Принимаю оферту' },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.acceptTerms, [required({ message: 'Необходимо принять условия' })]);`,
    },
  ],
  api: {
    component: CheckboxField,
    initialValue: false,
    baseComponentProps: { label: 'Согласен с условиями' },
    validators: [required({ message: 'Необходимо согласие' })],
    valuePresets: [
      { label: 'Отмечен (true)', value: true },
      { label: 'Снят (false)', value: false },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label — задаётся baseComponentProps (иначе перетрёт initialValue undefined-ом).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(checkboxBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  value: model.$.agree,
  component: CheckboxField,
  componentProps: {
    label: 'Согласен с условиями',${v.required ? '\n    required: true,' : ''}
  },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.value, [required()]);`,
  },
};
