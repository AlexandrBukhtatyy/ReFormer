import { useState } from 'react';
import { SwitchWithLabel, switchBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

/** Вне формы переключатель говорит на языке Radix: checked + onCheckedChange. */
function DarkModeSwitch() {
  const [dark, setDark] = useState(false);
  return <SwitchWithLabel checked={dark} onCheckedChange={setDark} label="Тёмная тема" />;
}

const DARK_MODE_CODE = `import { useState } from 'react';
import { SwitchWithLabel } from '@reformer/ui-kit';

function DarkModeSwitch() {
  const [dark, setDark] = useState(false);
  return <SwitchWithLabel checked={dark} onCheckedChange={setDark} label="Тёмная тема" />;
}`;

// Пропсы панели API — из props-схемы варианта. label задаётся baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(switchBasePropsSchema), {
  omit: ['label'],
});

export const switchDocConfig: ComponentDocConfig = {
  name: 'Switch',
  importFrom: '@reformer/ui-kit',
  description:
    'Выключатель «вкл / выкл». В форму — SwitchWithLabel: значение boolean, подпись справа.',
  variants: [
    fieldVariant({
      id: 'basic',
      title: 'Выключен',
      description:
        'Значение — boolean. Подпись из label стоит справа, клик по ней тоже переключает.',
      field: 'notifications',
      component: SwitchWithLabel,
      componentName: 'SwitchWithLabel',
      initial: false,
      props: { label: 'Push-уведомления' },
    }),
    fieldVariant({
      id: 'checked',
      title: 'Включён',
      description: 'Начальное значение true — выключатель включён сразу.',
      field: 'autosave',
      component: SwitchWithLabel,
      componentName: 'SwitchWithLabel',
      initial: true,
      showInitial: true,
      props: { label: 'Автосохранение' },
    }),
    {
      id: 'standalone',
      title: 'Вне формы',
      description:
        'Без формы SwitchWithLabel — обычный Radix-переключатель: checked и onCheckedChange.',
      render: DarkModeSwitch,
      code: DARK_MODE_CODE,
    },
  ],
  examples: [
    fieldVariant({
      id: 'hints',
      title: 'Пояснение и подсказка',
      description:
        'description — текст под выключателем, tooltip — иконка после подписи. Клик по иконке выключатель не трогает.',
      field: 'twoFactor',
      component: SwitchWithLabel,
      componentName: 'SwitchWithLabel',
      initial: true,
      props: {
        label: 'Вход по коду из СМС',
        description: 'Код приходит при каждом входе с нового устройства',
        tooltip: 'Защищает аккаунт, даже если пароль узнали',
      },
    }),
    fieldVariant({
      id: 'validation',
      title: 'Обязательное включение',
      description:
        'Для boolean правило required требует true. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'agree',
      component: SwitchWithLabel,
      componentName: 'SwitchWithLabel',
      initial: false,
      props: { label: 'Согласен с условиями' },
      validators: [required({ code: 'agree.required' })],
      rules: "required({ code: 'agree.required' })",
      messages: { 'agree.required': 'Без согласия продолжить нельзя' },
      touched: true,
    }),
  ],
  api: {
    component: SwitchWithLabel,
    initialValue: false,
    baseComponentProps: { label: 'Push-уведомления' },
    valuePresets: [
      { label: 'Включить (true)', value: true },
      { label: 'Выключить (false)', value: false },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'notifications',
        component: 'SwitchWithLabel',
        props: { label: 'Push-уведомления' },
        controls: API_CONTROLS,
        values: v,
      }),
  },
};
