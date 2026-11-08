import { useState } from 'react';
import { CheckboxWithLabel, checkboxBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

/** Вне формы чекбокс говорит на языке Radix: checked + onCheckedChange. */
function NewsletterCheckbox() {
  const [checked, setChecked] = useState(true);
  return (
    <CheckboxWithLabel
      checked={checked}
      onCheckedChange={(c) => setChecked(c === true)}
      label="Получать новости"
    />
  );
}

const NEWSLETTER_CODE = `import { useState } from 'react';
import { CheckboxWithLabel } from '@reformer/ui-kit';

function NewsletterCheckbox() {
  const [checked, setChecked] = useState(true);
  return (
    <CheckboxWithLabel
      checked={checked}
      onCheckedChange={(c) => setChecked(c === true)}
      label="Получать новости"
    />
  );
}`;

// Пропсы панели API — из props-схемы варианта. label задаётся baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(checkboxBasePropsSchema), {
  omit: ['label'],
});

export const checkboxDocConfig: ComponentDocConfig = {
  name: 'Checkbox',
  importFrom: '@reformer/ui-kit',
  description:
    'Флажок «да или нет». В форму — CheckboxWithLabel: значение boolean, подпись справа от флажка.',
  variants: [
    fieldVariant({
      id: 'consent',
      title: 'Согласие',
      description:
        'Значение — boolean. Подпись из label стоит справа от флажка, клик по ней тоже переключает.',
      field: 'agree',
      component: CheckboxWithLabel,
      componentName: 'CheckboxWithLabel',
      initial: false,
      props: { label: 'Согласен с условиями обработки данных' },
    }),
    fieldVariant({
      id: 'checked',
      title: 'Отмечен заранее',
      description: 'Начальное значение true — флажок отмечен сразу.',
      field: 'subscribe',
      component: CheckboxWithLabel,
      componentName: 'CheckboxWithLabel',
      initial: true,
      showInitial: true,
      props: { label: 'Получать уведомления' },
    }),
    {
      id: 'standalone',
      title: 'Вне формы',
      description:
        'Без формы CheckboxWithLabel — обычный Radix-чекбокс: checked и onCheckedChange вместо value и onChange.',
      render: NewsletterCheckbox,
      code: NEWSLETTER_CODE,
    },
  ],
  examples: [
    fieldVariant({
      id: 'validation',
      title: 'Обязательное согласие',
      description:
        'Для boolean правило required требует true. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'acceptTerms',
      component: CheckboxWithLabel,
      componentName: 'CheckboxWithLabel',
      initial: false,
      props: { label: 'Принимаю условия оферты' },
      validators: [required({ code: 'acceptTerms.required' })],
      rules: "required({ code: 'acceptTerms.required' })",
      messages: { 'acceptTerms.required': 'Без согласия продолжить нельзя' },
      touched: true,
    }),
    fieldVariant({
      id: 'hints',
      title: 'Пояснение и подсказка',
      description:
        'description — текст под флажком, tooltip — иконка после подписи. Клик по иконке флажок не переключает.',
      field: 'marketing',
      component: CheckboxWithLabel,
      componentName: 'CheckboxWithLabel',
      initial: false,
      props: {
        label: 'Получать предложения банка',
        description: 'Не чаще раза в неделю',
        tooltip: 'Отписаться можно в личном кабинете',
      },
    }),
  ],
  api: {
    component: CheckboxWithLabel,
    initialValue: false,
    baseComponentProps: { label: 'Согласен с условиями' },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Необходимо согласие' },
    valuePresets: [
      { label: 'Отмечен (true)', value: true },
      { label: 'Снят (false)', value: false },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'agree',
        component: 'CheckboxWithLabel',
        props: { label: 'Согласен с условиями' },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
