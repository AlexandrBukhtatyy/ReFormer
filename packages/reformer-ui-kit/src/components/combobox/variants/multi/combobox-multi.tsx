import * as React from 'react';
import { ChevronsUpDownIcon, PlusIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';
import type { ComboboxOption } from '../base/combobox-base';

/** Сколько чипов показать в триггере, прежде чем схлопнуть их в сводку «Выбрано: N». */
const DEFAULT_SUMMARY_THRESHOLD = 3;

/** Props компонента {@link ComboboxMulti}. */
export interface ComboboxMultiProps {
  className?: string;
  /**
   * Выбранные значения. Приходит массивом всегда: `multiValueAdapter` разворачивает `null` в `[]`,
   * потому что рендер ходит по значению `.includes`/`.map`.
   */
  value?: string[];
  /** Изменение выбора. Всегда получает НОВЫЙ массив — см. `multiValueAdapter`. */
  onChange?: (value: string[]) => void;
  /** Срабатывает при закрытии popover (снятие фокуса). */
  onBlur?: () => void;
  /** Список опций. */
  options?: ComboboxOption[];
  /** Подсказка в триггере, пока ничего не выбрано. */
  placeholder?: string;
  /** Подсказка в поле поиска. */
  searchPlaceholder?: string;
  /** Текст пустого состояния (ничего не найдено). */
  emptyText?: string;
  /** Показывать крестик сброса ВСЕГО выбора. */
  clearable?: boolean;
  /**
   * Creatable-режим: введённое значение, не совпавшее ни с одной опцией, добавляется в выбор
   * пунктом «Создать». Лейблом для него служит само значение.
   */
  creatable?: boolean;
  /**
   * Потолок числа выбранных: по достижении невыбранные пункты выключаются.
   * Подсказка интерфейса, а НЕ правило формы — ограничение задавайте валидатором `maxLength(n)`.
   */
  maxItems?: number;
  /** Сколько чипов показать в триггере до схлопывания в сводку. По умолчанию 3. */
  summaryThreshold?: number;
  disabled?: boolean;
  /** id корневого элемента — по нему форма связывает подпись, описание и сообщение об ошибке. */
  id?: string;
  /** Префикс `data-testid`; на триггер + `-<value>` на каждый пункт списка. */
  'data-testid'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-required'?: boolean | 'true' | 'false';
}

/**
 * Императивный handle {@link ComboboxMulti}: baseline {@link FieldHandle} на кнопке-триггере +
 * управление popover'ом. Достаётся из схемы: `schema.node('tags').getRef<ComboboxMultiHandle>()`.
 */
export interface ComboboxMultiHandle extends FieldHandle {
  /** Открыть popover со списком. */
  open(): void;
  /** Закрыть popover (эмитит `onBlur`, как обычное закрытие). */
  close(): void;
  /** Сбросить весь выбор. */
  clear(): void;
}

/**
 * Combobox в режиме множественного выбора (вариант `multi`): та же композиция
 * Popover + Command + Button, что у одиночного, но со списком-чекбоксами и чипами в триггере.
 *
 * Три поведенческих отличия от одиночного варианта, и все три намеренные:
 *  - выбор пункта НЕ закрывает popover — иначе отметить несколько подряд было бы нельзя;
 *  - поиск НЕ сбрасывается после тогла: cmdk сам ведёт активный пункт, и сброс заставлял бы
 *    список перескакивать под курсором;
 *  - `onBlur` эмитится только при закрытии popover, поэтому поле дольше остаётся не-touched.
 *
 * Чипы в триггере НЕинтерактивны намеренно: интерактивный элемент внутри `button` — невалидная
 * разметка. Снять значение можно пунктом списка, сбросить всё — крестиком `clearable`, который
 * (как и у одиночного варианта) живёт ВНЕ триггера.
 */
const ComboboxMulti = React.forwardRef<ComboboxMultiHandle, ComboboxMultiProps>(
  function ComboboxMulti(
    {
      className,
      value,
      onChange,
      onBlur,
      options = [],
      placeholder,
      searchPlaceholder,
      emptyText,
      clearable = false,
      creatable = false,
      maxItems,
      summaryThreshold = DEFAULT_SUMMARY_THRESHOLD,
      disabled,
      id,
      'data-testid': dataTestId,
      'aria-invalid': ariaInvalid,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-errormessage': ariaErrorMessage,
      'aria-required': ariaRequired,
    },
    ref
  ) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);

    const selected = React.useMemo(() => value ?? [], [value]);

    React.useImperativeHandle(
      ref,
      () => ({
        ...makeElementFieldHandle(triggerRef),
        open: () => setOpen(true),
        close: () => setOpen(false),
        clear: () => onChange?.([]),
      }),
      [onChange]
    );

    // Для creatable значение может отсутствовать в options — тогда лейблом служит оно само.
    const labelOf = React.useCallback(
      (v: string) => options.find((opt) => opt.value === v)?.label ?? v,
      [options]
    );

    const atLimit = maxItems !== undefined && selected.length >= maxItems;

    const trimmedSearch = search.trim();
    const showCreate =
      creatable &&
      trimmedSearch.length > 0 &&
      !options.some((opt) => opt.label.toLowerCase() === trimmedSearch.toLowerCase()) &&
      !selected.includes(trimmedSearch);

    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      if (!next) {
        setSearch('');
        onBlur?.();
      }
    };

    /** Тогл значения. Массив ВСЕГДА новый: сигнал бэйлится по `!==`. */
    const toggle = (optionValue: string) => {
      onChange?.(
        selected.includes(optionValue)
          ? selected.filter((v) => v !== optionValue)
          : [...selected, optionValue]
      );
    };

    const handleCreate = () => {
      if (!trimmedSearch || atLimit) return;
      onChange?.([...selected, trimmedSearch]);
      setSearch('');
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.([]);
    };

    const showClearButton = clearable && selected.length > 0 && !disabled;
    const collapsed = selected.length > summaryThreshold;

    return (
      <div className="relative w-full">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
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
                'h-auto min-h-9 w-full justify-between font-normal',
                showClearButton && 'pr-14',
                className
              )}
            >
              {selected.length === 0 ? (
                <span className="truncate text-muted-foreground">
                  {placeholder ?? 'Select options...'}
                </span>
              ) : collapsed ? (
                <span className="truncate" data-slot="combobox-multi-summary">
                  Выбрано: {selected.length}
                </span>
              ) : (
                <span className="flex flex-wrap gap-1" data-slot="combobox-multi-chips">
                  {selected.map((v) => (
                    <Badge key={v} variant="secondary" data-slot="combobox-multi-chip">
                      {labelOf(v)}
                    </Badge>
                  ))}
                </span>
              )}
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
            <Command>
              <CommandInput
                placeholder={searchPlaceholder ?? 'Search...'}
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                {!showCreate && <CommandEmpty>{emptyText ?? 'No options found.'}</CommandEmpty>}
                <CommandGroup>
                  {options.map((option) => {
                    const checked = selected.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        // cmdk ищет по value: подставляем label, чтобы фильтр шёл по видимому тексту.
                        value={option.label}
                        // Потолок гасит только НЕвыбранные: иначе снять лишнее стало бы нечем.
                        disabled={atLimit && !checked}
                        onSelect={() => toggle(option.value)}
                        data-testid={dataTestId ? `${dataTestId}-${option.value}` : undefined}
                      >
                        <Checkbox
                          checked={checked}
                          // `[&_svg]:text-primary-foreground!` — не косметика, а обход правила
                          // самого CommandItem: он красит ЛЮБУЮ вложенную иконку в
                          // `text-muted-foreground` через `[&_svg:not([class*='text-'])]`
                          // (command-base.tsx). У `CheckIcon` внутри `Checkbox` класса с `text-`
                          // нет, поэтому галочка получала серый поверх `text-primary-foreground`
                          // родителя — на залитом primary квадрате её почти не было видно.
                          // Специфичность `:not([class*='text-'])` выше нашей, добавить класс
                          // самой иконке снаружи нельзя — отсюда `!`. Тот же приём и по той же
                          // причине использует upstream: `*:[svg]:text-destructive!` в
                          // context-menu / dropdown-menu / menubar.
                          className="pointer-events-none mr-2 [&_svg]:text-primary-foreground!"
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                        {option.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {showCreate && (
                  <CommandGroup>
                    {/* value=search → cmdk не отфильтрует пункт; выбор добавляет введённое в массив. */}
                    <CommandItem value={trimmedSearch} onSelect={handleCreate} disabled={atLimit}>
                      <PlusIcon className="mr-2 size-4" />
                      Создать: {trimmedSearch}
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {showClearButton && (
          <button
            type="button"
            className="absolute top-1/2 right-8 z-10 -translate-y-1/2 transform cursor-pointer border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
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
);
ComboboxMulti.displayName = 'ComboboxMulti';

export { ComboboxMulti };
