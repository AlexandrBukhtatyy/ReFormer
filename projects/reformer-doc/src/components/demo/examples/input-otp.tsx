import { useState } from 'react';
import {
  InputOTPField,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
  inputOtpBasePropsSchema,
} from '@reformer/ui-kit/input-otp';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, minLength } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

/* ─── Кастомная раскладка (ручная сборка base: две группы + сепаратор) ─── */

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
  importFrom: '@reformer/ui-kit',
  description:
    'Поле ввода одноразового кода (OTP) на input-otp. Дефолтная раскладка разворачивает одну группу из maxLength слотов; кастомная (разбивка на группы + InputOTPSeparator) собирается из base-примитивов. Значение — string | null (пустой ввод → null).',
  variants: [
    {
      id: 'six-digits',
      title: 'Код из 6 цифр',
      description: 'maxLength=6 (дефолт). Значение — string | null.',
      render: makeFieldVariant({
        initial: '',
        component: InputOTPField,
        componentProps: { label: 'Код подтверждения', maxLength: 6 },
      }),
      code: `{
  value: model.$.otp,
  component: InputOTPField,
  componentProps: { label: 'Код подтверждения', maxLength: 6 },
}`,
    },
    {
      id: 'four-digits',
      title: 'Короткий код из 4 цифр',
      description: 'maxLength=4 — четыре слота в одной группе.',
      render: makeFieldVariant({
        initial: '',
        component: InputOTPField,
        componentProps: { label: 'PIN', maxLength: 4 },
      }),
      code: `componentProps: { label: 'PIN', maxLength: 4 }`,
    },
    {
      id: 'split-layout',
      title: 'Кастомная раскладка (группы + сепаратор)',
      description:
        'Форма, недостижимая дефолтной раскладкой: 3 + 3 слота с InputOTPSeparator. Собирается из InputOTP / InputOTPGroup / InputOTPSlot / InputOTPSeparator варианта base.',
      render: SplitLayoutVariant,
      code: `import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@reformer/ui-kit';

<InputOTP maxLength={6} value={value} onChange={onChange}>
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
    {
      id: 'validation',
      title: 'Обязательный полный код (required + minLength)',
      description:
        'правила в validation-схеме (validate из @reformer/core/validation); touched-поле с неполным кодом показывает ошибку до набора всех 6 цифр.',
      render: makeFieldVariant({
        initial: '',
        component: InputOTPField,
        componentProps: { label: 'Код подтверждения', maxLength: 6 },
        validators: [
          required({ message: 'Введите код' }),
          minLength(6, { message: 'Код состоит из 6 цифр' }),
        ],
        touched: true,
      }),
      code: `{
  value: model.$.otp,
  component: InputOTPField,
  componentProps: { label: 'Код подтверждения', maxLength: 6 },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.otp, [required(), minLength(6)]);`,
    },
  ],
  api: {
    component: InputOTPField,
    initialValue: '',
    baseComponentProps: { label: 'Код подтверждения' },
    validators: [required({ message: 'Введите код' })],
    valuePresets: [
      { label: '123456', value: '123456' },
      { label: 'Очистить', value: '' },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label — задаётся baseComponentProps. maxLength оставляем (у него есть default 6).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(inputOtpBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  value: model.$.otp,
  component: InputOTPField,
  componentProps: {
    label: 'Код подтверждения',
    maxLength: ${v.maxLength || 6},${v.required ? '\n    required: true,' : ''}
  },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.value, [required()]);`,
  },
};
