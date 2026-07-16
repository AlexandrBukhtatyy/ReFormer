import * as React from 'react';
import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';

// Combobox — не отдельный shadcn-примитив, а РЕЦЕПТ: композиция Popover + Command + Button
// (new-york-v4 combobox.json — это demo на @base-ui, чужой стек). Собран по каноничному
// shadcn-паттерну «триггер-кнопка с текущим label + Popover со списком Command (поиск + опции)».
// Value-based контракт (`value: string|null` / `onChange(string|null)` / `onBlur`) — пригоден
// для формы напрямую (см. ComboboxField).

/** Опция комбобокса: `value` — хранимое значение, `label` — отображаемый и искомый текст. */
export interface ComboboxOption {
  value: string;
  label: string;
}

/** Props компонента {@link Combobox}. */
export interface ComboboxProps {
  className?: string;
  /** Выбранное значение (строка из `option.value`). `null` — ничего не выбрано. */
  value?: string | null;
  /** Обработчик выбора. При очистке (крестик / повторный клик по выбранной опции) приходит `null`. */
  onChange?: (value: string | null) => void;
  /** Срабатывает при закрытии popover (снятие фокуса). */
  onBlur?: () => void;
  /** Список опций. */
  options?: ComboboxOption[];
  /** Подсказка в триггере, пока ничего не выбрано. По умолчанию `'Select an option...'`. */
  placeholder?: string;
  /** Подсказка в поле поиска. По умолчанию `'Search...'`. */
  searchPlaceholder?: string;
  /** Текст пустого состояния (ничего не найдено). По умолчанию `'No options found.'`. */
  emptyText?: string;
  /** Показывать ли крестик очистки справа от значения. По умолчанию `false`. */
  clearable?: boolean;
  disabled?: boolean;
  id?: string;
  'data-testid'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-required'?: boolean | 'true' | 'false';
}

/**
 * Combobox (вариант `base`): управляемый поиск по опциям в Popover + Command. Триггер-кнопка
 * показывает `label` текущего значения либо `placeholder`. Выбор опции эмитит `onChange(value)`;
 * при `clearable` повторный клик по выбранной опции или крестик сбрасывают выбор в `null`.
 */
function Combobox({
  className,
  value,
  onChange,
  onBlur,
  options = [],
  placeholder,
  searchPlaceholder,
  emptyText,
  clearable = false,
  disabled,
  id,
  'data-testid': dataTestId,
  'aria-invalid': ariaInvalid,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-errormessage': ariaErrorMessage,
  'aria-required': ariaRequired,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedLabel = React.useMemo(
    () => options.find((opt) => opt.value === value)?.label,
    [options, value]
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) onBlur?.();
  };

  const handleSelect = (optionValue: string) => {
    // clearable: повторный выбор текущей опции сбрасывает значение (toggle-off).
    onChange?.(clearable && optionValue === value ? null : optionValue);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(null);
  };

  const showClearButton = clearable && !!value && !disabled;

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            id={id}
            data-testid={dataTestId}
            aria-invalid={ariaInvalid}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-errormessage={ariaErrorMessage}
            aria-required={ariaRequired}
            className={cn(
              'w-full justify-between font-normal',
              showClearButton && 'pr-14',
              className
            )}
          >
            <span className={cn('truncate', selectedLabel == null && 'text-muted-foreground')}>
              {selectedLabel ?? placeholder ?? 'Select an option...'}
            </span>
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder ?? 'Search...'} />
            <CommandList>
              <CommandEmpty>{emptyText ?? 'No options found.'}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    // cmdk ищет по value: подставляем label, чтобы фильтр шёл по видимому тексту.
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <CheckIcon
                      className={cn(
                        'mr-2 size-4',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showClearButton && (
        <button
          type="button"
          className="absolute right-8 top-1/2 z-10 -translate-y-1/2 transform cursor-pointer border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
          onClick={handleClear}
          aria-label="Clear selection"
          tabIndex={-1}
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
Combobox.displayName = 'Combobox';

export { Combobox };
