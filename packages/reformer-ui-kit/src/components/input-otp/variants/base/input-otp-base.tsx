import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { MinusIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

// Дословный порт shadcn/ui (new-york-v4) input-otp. Правки: `@/lib/utils`, снят 'use client';
// ошибка ячеек — от `aria-invalid` самого поля (см. InputOTPInvalidContext).
// Тяжёлая dep `input-otp` (OTPInput/OTPInputContext) импортируется как есть (external в vite.config).

/**
 * Ошибка поля для ячеек. `aria-invalid` обёртка поля кладёт на скрытый `<input>` (его и читает
 * скринридер), а рамку рисуют ячейки-`div`: у апстрима они ждут `aria-invalid` на себе, и рамка
 * ошибки в форме не появлялась никогда. Контекст несёт состояние поля в каждую ячейку.
 */
const InputOTPInvalidContext = React.createContext(false);

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  return (
    <InputOTPInvalidContext.Provider value={invalid}>
      <OTPInput
        data-slot="input-otp"
        containerClassName={cn(
          'flex items-center gap-2 has-disabled:opacity-50',
          containerClassName
        )}
        className={cn('disabled:cursor-not-allowed', className)}
        {...props}
      />
    </InputOTPInvalidContext.Provider>
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="input-otp-group" className={cn('flex items-center', className)} {...props} />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const invalid = React.useContext(InputOTPInvalidContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      data-invalid={invalid || undefined}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md aria-invalid:border-destructive data-invalid:border-destructive data-[active=true]:data-invalid:border-destructive data-[active=true]:data-invalid:ring-destructive/20 dark:data-[active=true]:data-invalid:ring-destructive/40 data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40',
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
