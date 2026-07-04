import * as React from 'react';
import { cn } from '@/lib/utils';

/** Props компонента {@link Checkbox}. */
export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'checked' | 'defaultChecked'
> {
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
    {
      className,
      value,
      onChange,
      onBlur,
      label,
      disabled,
      'data-testid': dataTestId,
      id,
      'aria-labelledby': ariaLabelledBy,
      ...props
    },
    ref
  ) => {
    // Стабильный id для программной связки внутренней <label> с input. В потоке
    // FormField сюда приходит `id={ids.controlId}` из FormFieldControl; при
    // standalone-использовании генерируем свой через useId.
    const reactId = React.useId();
    const inputId = id ?? reactId;

    // Когда рендерим собственную <label htmlFor>, именно она даёт доступное имя.
    // FormFieldControl выставляет `aria-labelledby={ids.labelId}`, но ui-kit
    // FormField намеренно не рендерит верхний Label для чекбоксов — значит это
    // висячий IDREF (accname его игнорирует). Сбрасываем его, чтобы имя бралось
    // из связанной <label>. Без внутренней метки оставляем как есть (внешняя
    // подпись — ответственность потребителя).
    const resolvedAriaLabelledBy = label ? undefined : ariaLabelledBy;

    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.checked);
    };

    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          id={inputId}
          checked={value || false}
          disabled={disabled}
          className={cn(
            'h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive',
            className
          )}
          onChange={handleCheckboxChange}
          onBlur={onBlur}
          data-testid={dataTestId}
          aria-labelledby={resolvedAriaLabelledBy}
          {...props}
        />
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
