import * as React from 'react';
import { cn } from '@/lib/utils';

/** Props компонента {@link Textarea}. */
export interface TextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange' | 'defaultValue'
> {
  /** Дополнительный CSS-класс. */
  className?: string;
  /** Текущее значение. `null`/`undefined` рендерится как пустое поле. */
  value?: string | null;
  /** Обработчик изменений. Пустая строка приводится к `null`. */
  onChange?: (value: string | null) => void;
  /** Срабатывает при потере фокуса. */
  onBlur?: () => void;
  /** Подсказка внутри поля. */
  placeholder?: string;
  /** Блокирует ввод. */
  disabled?: boolean;
  /** Видимая высота в строках. По умолчанию `3`. */
  rows?: number;
  /**
   * Hard-лимит длины (нативное HTML-поведение). Используется как soft-protection
   * на уровне UI; для бизнес-валидации добавляй `maxLength` через `validations`.
   */
  maxLength?: number;
}

/**
 * Многострочное поле ввода. Resize по вертикали разрешён (`resize-y`).
 *
 * @example Поле для комментария с лимитом длины
 * ```tsx
 * import { Textarea } from '@reformer/ui-kit';
 *
 * <Textarea
 *   value={comment}
 *   onChange={setComment}
 *   rows={5}
 *   maxLength={500}
 *   placeholder="Опишите проблему"
 * />
 * ```
 *
 * @example Поле адреса
 * ```tsx
 * import { Textarea } from '@reformer/ui-kit';
 *
 * <Textarea
 *   value={address}
 *   onChange={setAddress}
 *   rows={3}
 *   placeholder="Адрес доставки"
 * />
 * ```
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, value, onChange, onBlur, placeholder, disabled, rows = 3, maxLength, ...props },
    ref
  ) => {
    const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      onChange?.(newValue || null);
    };

    const textareaValue = React.useMemo(() => {
      if (value === null || value === undefined) return '';
      return String(value);
    }, [value]);

    return (
      <textarea
        ref={ref}
        value={textareaValue}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={cn(
          'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          'resize-y',
          className
        )}
        onChange={handleTextareaChange}
        onBlur={onBlur}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
