import * as React from 'react';
import { cn } from '@/lib/utils';

/** Props компонента {@link Checkbox}. */
export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Дополнительный CSS-класс для самого input. */
  className?: string;
  /** Состояние чекбокса. `undefined` рендерится как `false`. */
  value?: boolean;
  /** Вызывается при изменении. Получает `event.target.checked`. */
  onChange?: (value: boolean) => void;
  /** Срабатывает при потере фокуса. */
  onBlur?: () => void;
  /** Подпись справа от чекбокса. Если опущена — рендерится только сам контрол. */
  label?: string;
  /** Блокирует переключение. */
  disabled?: boolean;
  /** Test-id для e2e (используется как `data-testid` на input). */
  'data-testid'?: string;
}

/**
 * Чекбокс с опциональной подписью справа. Контракт `value`/`onChange` —
 * `boolean`, не строка.
 *
 * `FormField` из `@reformer/ui-kit` детектит `Checkbox` и не рендерит верхний
 * `Label`, чтобы не дублировать подпись.
 *
 * @example Согласие с условиями
 * ```tsx
 * import { Checkbox } from '@reformer/ui-kit';
 *
 * <Checkbox
 *   value={agree}
 *   onChange={setAgree}
 *   label="Согласен с условиями обработки персональных данных"
 * />
 * ```
 *
 * @example Без подписи (label справа добавляется снаружи)
 * ```tsx
 * import { Checkbox } from '@reformer/ui-kit';
 *
 * <div className="flex items-center gap-2">
 *   <Checkbox value={hasMortgage} onChange={setHasMortgage} />
 *   <span>У меня уже есть ипотека</span>
 * </div>
 * ```
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, value, onChange, onBlur, label, disabled, 'data-testid': dataTestId, ...props },
    ref
  ) => {
    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.checked);
    };

    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          checked={value || false}
          disabled={disabled}
          className={cn(
            'h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          onChange={handleCheckboxChange}
          onBlur={onBlur}
          data-testid={dataTestId}
          {...props}
        />
        {label && (
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
