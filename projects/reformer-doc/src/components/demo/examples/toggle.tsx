import { useState } from 'react';
import { BoldIcon } from 'lucide-react';
import { Toggle, toggleBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

/** Вне формы: кнопка-иконка с pressed + onPressedChange и подписью для скринридера. */
function BoldToggle() {
  const [bold, setBold] = useState(false);
  return (
    <Toggle variant="outline" aria-label="Полужирный" pressed={bold} onPressedChange={setBold}>
      <BoldIcon />
    </Toggle>
  );
}

const BOLD_TOGGLE_CODE = `import { useState } from 'react';
import { BoldIcon } from 'lucide-react';
import { Toggle } from '@reformer/ui-kit';

function BoldToggle() {
  const [bold, setBold] = useState(false);
  return (
    <Toggle variant="outline" aria-label="Полужирный" pressed={bold} onPressedChange={setBold}>
      <BoldIcon />
    </Toggle>
  );
}`;

// Пропсы панели API — из props-схемы варианта. label и children задаются baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(toggleBasePropsSchema), {
  omit: ['label', 'children'],
});

export const toggleDocConfig: ComponentDocConfig = {
  name: 'Toggle',
  importFrom: '@reformer/ui-kit',
  description:
    'Кнопка, которая остаётся нажатой. Значение — boolean; подпись поля стоит сверху, на кнопке — текст или иконка из children.',
  variants: [
    fieldVariant({
      id: 'basic',
      title: 'Нажата или нет',
      description:
        'Значение — boolean. Подпись поля рисует FormField сверху, текст на кнопке — children.',
      field: 'pinned',
      component: Toggle,
      componentName: 'Toggle',
      initial: false,
      props: { label: 'Закрепить в списке', children: 'Закрепить' },
    }),
    fieldVariant({
      id: 'outline',
      title: 'С рамкой, нажата заранее',
      description: 'variant: "outline" — кнопка с рамкой. Начальное значение true — кнопка нажата.',
      field: 'favorite',
      component: Toggle,
      componentName: 'Toggle',
      initial: true,
      showInitial: true,
      props: { label: 'Избранное', children: 'В избранном', variant: 'outline' },
    }),
    {
      id: 'icon',
      title: 'Кнопка-иконка вне формы',
      description:
        'Вне формы Toggle — Radix-кнопка: pressed и onPressedChange. У кнопки без текста нужен aria-label.',
      render: BoldToggle,
      code: BOLD_TOGGLE_CODE,
    },
  ],
  examples: [
    fieldVariant({
      id: 'size',
      title: 'Размер',
      description: 'size: "sm", "default" или "lg" меняет высоту и минимальную ширину кнопки.',
      field: 'compact',
      component: Toggle,
      componentName: 'Toggle',
      initial: false,
      props: { label: 'Компактный вид', children: 'Компактно', size: 'sm', variant: 'outline' },
    }),
    fieldVariant({
      id: 'validation',
      title: 'Обязательное нажатие',
      description:
        'Для boolean правило required требует true. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'confirmed',
      component: Toggle,
      componentName: 'Toggle',
      initial: false,
      props: { label: 'Данные проверены', children: 'Подтверждаю', required: true },
      validators: [required({ code: 'confirmed.required' })],
      rules: "required({ code: 'confirmed.required' })",
      messages: { 'confirmed.required': 'Подтвердите, что данные проверены' },
      touched: true,
    }),
  ],
  api: {
    component: Toggle,
    initialValue: false,
    // label и children не управляются панелью: children — содержимое кнопки, а не проп-настройка.
    baseComponentProps: { label: 'Закрепить в списке', children: 'Закрепить' },
    valuePresets: [
      { label: 'Нажата (true)', value: true },
      { label: 'Отжата (false)', value: false },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'pinned',
        component: 'Toggle',
        props: { label: 'Закрепить в списке', children: 'Закрепить' },
        controls: API_CONTROLS,
        values: v,
      }),
  },
};
