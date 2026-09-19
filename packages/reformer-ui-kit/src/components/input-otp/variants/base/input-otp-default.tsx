import * as React from 'react';

import { defineFieldControl } from '@/fields/field-control';
import type { KitFieldAdapter } from '@/fields/adapters';
import { withFieldTooltip, OUTSIDE_CENTER } from '@/fields/field-tooltip';
import { InputOTP, InputOTPGroup, InputOTPSlot } from './input-otp-base';

/**
 * Локальный адаптер OTP-поля. `OTPInput` эмитит уже готовую строку (`onChange(newValue: string)`),
 * а не DOM-event — поэтому `nativeInputAdapter` (`e.target.value`) не подходит. Пресет узкий и
 * специфичный для input-otp, поэтому живёт здесь, а НЕ в общем `fields/adapters.ts`.
 *
 * value-based контракт seam: `value: string | null` (пустой ввод → null), `onChange(string | null)`.
 */
export const otpAdapter: KitFieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (v) => (v as string) || null,
  toValue: (v) => (v ?? '') as string,
};

export interface InputOTPDefaultProps {
  /** Число слотов (длина кода). По умолчанию 6. */
  maxLength?: number;
  containerClassName?: string;
  className?: string;
  /** Кастомная раскладка слотов/групп/сепараторов. Если не задана — одна группа из `maxLength` слотов. */
  children?: React.ReactNode;
  [key: string]: unknown;
}

/**
 * Презентационная обёртка над pure `InputOTP`: по умолчанию разворачивает одну `InputOTPGroup`
 * из `maxLength` слотов. Кастомная раскладка (разбивка на группы + `InputOTPSeparator`) достижима
 * передачей `children` или ручной сборкой из base-примитивов.
 */
function InputOTPDefaultBase(props: InputOTPDefaultProps) {
  const { maxLength = 6, children, ...rest } = props;
  const slots = children ?? (
    <InputOTPGroup>
      {Array.from({ length: maxLength }, (_, i) => (
        <InputOTPSlot key={i} index={i} />
      ))}
    </InputOTPGroup>
  );
  // OTPInputProps — дискриминантный union (render | children); собираем один объект и кастуем,
  // чтобы JSX-спред не спотыкался о ветку `render?: never`.
  const otpProps = { ...rest, maxLength, children: slots } as unknown as React.ComponentProps<
    typeof InputOTP
  >;
  return <InputOTP {...otpProps} />;
}

/**
 * OTP-поле с дефолтной раскладкой слотов — компонент для формы (`component: InputOTPDefault`,
 * registry `InputOTP`): строковый {@link otpAdapter} (статика) + проп `tooltip`.
 */
const InputOTPDefault = defineFieldControl(withFieldTooltip(InputOTPDefaultBase, OUTSIDE_CENTER), {
  adapter: otpAdapter,
});
InputOTPDefault.displayName = 'InputOTPDefault';

export { InputOTPDefault };
