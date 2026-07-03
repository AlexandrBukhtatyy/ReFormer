import * as React from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Props компонента {@link InputPassword}. */
export interface InputPasswordProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'defaultValue'
> {
  /** Дополнительный CSS-класс. */
  className?: string;
  /** Текущее значение пароля. `null`/`undefined` рендерится как пустое поле. */
  value?: string | null;
  /** Обработчик изменений. Пустая строка приводится к `null`. */
  onChange?: (value: string | null) => void;
  /** Срабатывает при потере фокуса. */
  onBlur?: () => void;
  /** Подсказка внутри поля. По умолчанию `'Password'`. */
  placeholder?: string;
  /** Блокирует ввод. */
  disabled?: boolean;
  /**
   * Показывать ли иконку переключения видимости (eye/eye-off). По умолчанию
   * `true`. Иконка появляется только когда `value` непустой.
   */
  showToggle?: boolean;
}

/**
 * Поле ввода пароля с переключателем видимости (иконка eye/eye-off).
 * Кнопка переключения показывается, когда `showToggle = true` (по умолчанию)
 * и `value` непустой.
 *
 * @example С переключателем видимости
 * ```tsx
 * import { InputPassword } from '@reformer/ui-kit';
 *
 * <InputPassword
 *   value={password}
 *   onChange={setPassword}
 *   placeholder="Пароль"
 * />
 * ```
 *
 * @example Без переключателя (например, для подтверждения пароля)
 * ```tsx
 * import { InputPassword } from '@reformer/ui-kit';
 *
 * <InputPassword
 *   value={confirmPassword}
 *   onChange={setConfirmPassword}
 *   placeholder="Повторите пароль"
 *   showToggle={false}
 * />
 * ```
 */
const InputPassword = React.forwardRef<HTMLInputElement, InputPasswordProps>(
  (
    {
      className,
      value,
      onChange,
      onBlur,
      placeholder = 'Password',
      disabled,
      showToggle = true,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.value || null);
    };

    const togglePasswordVisibility = () => {
      setShowPassword(!showPassword);
    };

    const hasValue = Boolean(value);

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          value={value || ''}
          disabled={disabled}
          placeholder={placeholder}
          data-slot="input"
          className={cn(
            'h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            showToggle && hasValue && 'pr-10',
            className
          )}
          onChange={handleInputChange}
          onBlur={onBlur}
          {...props}
        />
        {showToggle && hasValue && (
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer focus:outline-none"
            onClick={togglePasswordVisibility}
            disabled={disabled}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              lineHeight: 0,
            }}
          >
            {showPassword ? (
              <EyeOffIcon style={{ width: '1rem', height: '1rem' }} />
            ) : (
              <EyeIcon style={{ width: '1rem', height: '1rem' }} />
            )}
          </button>
        )}
      </div>
    );
  }
);

InputPassword.displayName = 'InputPassword';

export { InputPassword };
