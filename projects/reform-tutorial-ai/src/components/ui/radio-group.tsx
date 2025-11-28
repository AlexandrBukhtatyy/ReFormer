import * as React from 'react';
import { cn } from '@/lib/utils';

export interface RadioGroupProps {
  className?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  options?: Array<{ value: string; label: string }>;
  label?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    {
      className,
      value,
      onChange,
      onBlur,
      options = [],
      label,
      disabled,
      'data-testid': dataTestId,
    },
    ref
  ) => {
    const handleChange = (newValue: string) => {
      onChange?.(newValue);
    };

    return (
      <div ref={ref} className={cn('space-y-2', className)} data-testid={dataTestId}>
        {label && (
          <label className="text-sm font-medium leading-none">{label}</label>
        )}
        <div className="flex flex-wrap gap-4">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <input
                type="radio"
                name={dataTestId}
                value={option.value}
                checked={value === option.value}
                onChange={() => handleChange(option.value)}
                onBlur={onBlur}
                disabled={disabled}
                className="h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';

export { RadioGroup };
