import { useState } from 'react';
import {
  InputOTPDefault,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
  REGEXP_ONLY_DIGITS,
  inputOtpBasePropsSchema,
} from '@reformer/ui-kit/input-otp';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, minLength } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant, raw } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

// Пропсы панели API — из props-схемы компонента. label задаётся baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(inputOtpBasePropsSchema), {
  omit: ['label'],
});

/* ─── Своя раскладка: части InputOTP собраны вручную, вне формы ─── */

function SplitLayoutVariant() {
  const [value, setValue] = useState('');
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <InputOTP maxLength={6} value={value} onChange={setValue}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

export const inputOtpDocConfig: ComponentDocConfig = {
  name: 'InputOTP',
  importFrom: '@reformer/ui-kit/input-otp',
  description:
    'Поле одноразового кода: каждая цифра — в своей ячейке. Значение — string | null: пустое поле даёт null.',
  variants: [
    fieldVariant({
      id: 'six-digits',
      title: 'Код из 6 символов',
      description: 'InputOTPDefault рисует одну группу из maxLength ячеек. По умолчанию — 6.',
      field: 'otp',
      component: InputOTPDefault,
      componentName: 'InputOTPDefault',
      initial: '',
      props: { label: 'Код подтверждения', maxLength: 6 },
    }),
    fieldVariant({
      id: 'four-digits',
      title: 'PIN из 4 символов',
      description: 'maxLength={4} — четыре ячейки.',
      field: 'pin',
      component: InputOTPDefault,
      componentName: 'InputOTPDefault',
      initial: '',
      props: { label: 'PIN', maxLength: 4 },
    }),
    {
      id: 'split-layout',
      title: 'Своя раскладка: 3 + 3',
      description:
        'Группы и разделитель собираются из частей InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator. Пример вне формы: значение в useState.',
      render: SplitLayoutVariant,
      code: `import { useState } from 'react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@reformer/ui-kit/input-otp';

const [value, setValue] = useState('');

<InputOTP maxLength={6} value={value} onChange={setValue}>
  <InputOTPGroup>
    <InputOTPSlot index={0} />
    <InputOTPSlot index={1} />
    <InputOTPSlot index={2} />
  </InputOTPGroup>
  <InputOTPSeparator />
  <InputOTPGroup>
    <InputOTPSlot index={3} />
    <InputOTPSlot index={4} />
    <InputOTPSlot index={5} />
  </InputOTPGroup>
</InputOTP>`,
    },
  ],
  examples: [
    fieldVariant({
      id: 'validation',
      title: 'Код набран целиком',
      description:
        'required и minLength(6) в схеме валидации: пока набраны не все символы, видно замечание. Поле уже тронуто, поэтому замечание показано сразу.',
      field: 'otp',
      component: InputOTPDefault,
      componentName: 'InputOTPDefault',
      initial: '',
      props: { label: 'Код подтверждения', maxLength: 6 },
      validators: [required({ code: 'otp.required' }), minLength(6, { code: 'otp.minLength' })],
      rules: "required({ code: 'otp.required' }), minLength(6, { code: 'otp.minLength' })",
      messages: { 'otp.required': 'Введите код', 'otp.minLength': 'Код состоит из 6 цифр' },
      touched: true,
    }),
    fieldVariant({
      id: 'digits-only',
      title: 'Только цифры',
      description:
        'Без pattern ячейки принимают любые символы. Регулярное выражение строкой в pattern не даёт набрать или вставить то, что ему не подходит. Готовые значения — REGEXP_ONLY_DIGITS, REGEXP_ONLY_CHARS, REGEXP_ONLY_DIGITS_AND_CHARS из @reformer/ui-kit/input-otp.',
      field: 'otp',
      component: InputOTPDefault,
      componentName: 'InputOTPDefault',
      initial: '',
      props: { label: 'Код из СМС', maxLength: 6, pattern: REGEXP_ONLY_DIGITS },
      codeProps: { pattern: raw('REGEXP_ONLY_DIGITS') },
    }),
  ],
  api: {
    component: InputOTPDefault,
    initialValue: '',
    baseComponentProps: { label: 'Код подтверждения' },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Введите код' },
    valuePresets: [
      { label: '123456', value: '123456' },
      { label: 'Очистить', value: '' },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'otp',
        component: 'InputOTPDefault',
        props: { label: 'Код подтверждения' },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
