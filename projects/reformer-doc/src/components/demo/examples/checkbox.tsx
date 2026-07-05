import { Checkbox } from '@reformer/ui-kit';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import type { ComponentDocConfig } from '../types';

export const checkboxDocConfig: ComponentDocConfig = {
  name: 'Checkbox',
  importFrom: '@reformer/ui-kit',
  description: 'Булев чекбокс с подписью справа. Контракт value/onChange — boolean.',
  variants: [
    {
      id: 'basic',
      title: 'С подписью',
      description: 'label справа от контрола.',
      render: makeFieldVariant({
        initial: false,
        component: Checkbox,
        componentProps: { label: 'Согласен с условиями обработки данных' },
      }),
      code: `{
  value: model.$.agree,
  component: Checkbox,
  componentProps: { label: 'Согласен с условиями обработки данных' },
}`,
    },
    {
      id: 'checked',
      title: 'Отмечен',
      description: 'Начальное значение true.',
      render: makeFieldVariant({
        initial: true,
        component: Checkbox,
        componentProps: { label: 'Получать уведомления' },
      }),
      code: `const model = createModel({ notify: true });`,
    },
    {
      id: 'disabled',
      title: 'Заблокирован',
      description: 'Через control.disable().',
      render: makeFieldVariant({
        initial: true,
        component: Checkbox,
        componentProps: { label: 'Опция недоступна' },
        disabled: true,
      }),
      code: `form.agree.disable();`,
    },
  ],
  examples: [
    {
      id: 'required',
      title: 'Обязательное согласие',
      description: 'required не пропустит форму, пока чекбокс не отмечен.',
      render: makeFieldVariant({
        initial: false,
        component: Checkbox,
        componentProps: { label: 'Принимаю условия' },
        validators: [required({ message: 'Необходимо согласие' })],
      }),
      code: `{
  value: model.$.accept,
  component: Checkbox,
  componentProps: { label: 'Принимаю условия' },
  validators: [required({ message: 'Необходимо согласие' })],
}`,
    },
  ],
  api: {
    component: Checkbox,
    initialValue: false,
    baseComponentProps: { label: 'Согласен с условиями' },
    validators: [required({ message: 'Необходимо согласие' })],
    valuePresets: [
      { label: 'Отметить', value: true },
      { label: 'Снять', value: false },
    ],
    controls: [
      {
        prop: 'value',
        type: 'boolean',
        group: 'Control',
        kind: 'readonly',
        description: 'Состояние чекбокса. undefined рендерится как false.',
      },
      {
        prop: 'onChange',
        type: '(value: boolean) => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Получает event.target.checked.',
      },
      {
        prop: 'onBlur',
        type: '() => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Срабатывает при потере фокуса.',
      },
      {
        prop: 'label',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: 'Согласен с условиями',
        description: 'Подпись справа. Без неё рендерится только контрол.',
      },
      {
        prop: 'disabled',
        type: 'boolean',
        group: 'State',
        kind: 'boolean',
        default: false,
        description: 'Блокирует переключение.',
      },
    ],
    code: (v) => `{
  value: model.$.accept,
  component: Checkbox,
  componentProps: { label: '${v.label}' },
  validators: [required()],
}${v.disabled ? '\n// form.accept.disable()' : ''}`,
  },
};
