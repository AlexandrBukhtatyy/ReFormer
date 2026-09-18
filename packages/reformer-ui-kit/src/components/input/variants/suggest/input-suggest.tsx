import * as React from 'react';
import {
  useAutocomplete,
  type AutocompleteSuggestions,
  type AutocompleteFilter,
} from '@reformer/cdk/autocomplete';
import { isNearBottom } from '@reformer/cdk/option-source';

import { cn } from '@/lib/utils';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/popover';
import { Spinner } from '@/components/spinner';
import { Input } from '../base/input-base';

// ReFormer-original (не shadcn): Input с подсказками. Логика — headless `useAutocomplete` из
// @reformer/cdk; здесь только разметка: shadcn Input + список в Popover, привязанном к полю через
// PopoverAnchor. Значение — всегда введённый текст, подсказка лишь подставляет свой `value`
// (в отличие от Combobox, где значение обязано быть опцией).

/** Props {@link InputSuggest}. */
export interface InputSuggestProps extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'ref'
> {
  /** Доп. CSS-класс поля ввода. */
  className?: string;
  /** Текст поля. `null` — пусто. */
  value?: string | null;
  /** Изменение текста: на каждый ввод и при выборе подсказки. Пустое поле → `''`. */
  onChange?: (value: string) => void;
  /**
   * Подсказки: строки, `{ value, label? }` или асинхронный `ResourceConfig` (как у Select).
   * Выбор подсказки пишет в поле её `value`; `label` — только текст пункта списка.
   */
  suggestions?: AutocompleteSuggestions | null;
  /** Минимальная длина текста, с которой показываются подсказки. @default 0 */
  minChars?: number;
  /** Раскрывать список при фокусе, не дожидаясь ввода. @default false */
  openOnFocus?: boolean;
  /** Свой предикат совпадения. По умолчанию — подстрока подписи без учёта регистра. */
  filter?: AutocompleteFilter;
}

const ITEM_CLASS =
  'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[active=true]:bg-accent data-[active=true]:text-accent-foreground';

/**
 * InputSuggest (вариант `suggest`): текстовое поле со свободным вводом и списком подсказок.
 * В форме используется через `InputField` — достаточно передать `suggestions`.
 *
 * Клавиатура: ↓/↑ — по подсказкам, Enter — подставить подсвеченную (без подсветки Enter
 * отправляет форму как обычно), Esc — закрыть список.
 */
const InputSuggest = React.forwardRef<HTMLInputElement, InputSuggestProps>(function InputSuggest(
  { value, onChange, suggestions, minChars, openOnFocus, filter, disabled, ...props },
  ref
) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  const ac = useAutocomplete({
    value: value ?? '',
    onChange: (next) => onChange?.(next),
    suggestions,
    minChars,
    openOnFocus,
    filter,
    disabled,
    id: props.id,
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (ac.hasMore && isNearBottom(e.currentTarget)) ac.loadMore();
  };

  return (
    <Popover open={ac.open} onOpenChange={ac.setOpen}>
      <PopoverAnchor asChild>
        {/* data-slot явно: иначе Radix Anchor (asChild) перетирает его своим `popover-anchor`. */}
        <Input ref={setRefs} data-slot="input" {...ac.getInputProps({ ...props, disabled })} />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-40 p-1"
        // Фокус остаётся в поле: список — лишь подсказка к вводу.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // Клик по самому полю — не «снаружи»: иначе он закрывал бы список посреди ввода.
        onInteractOutside={(e) => {
          if (e.target === inputRef.current) e.preventDefault();
        }}
      >
        <div
          {...ac.getListboxProps({
            className: 'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto',
            onScroll: handleScroll,
          })}
        >
          {ac.items.map((item, index) => (
            <div
              key={item.id}
              data-slot="input-suggest-item"
              {...ac.getOptionProps(item, index, { className: cn(ITEM_CLASS) })}
            >
              {item.label}
            </div>
          ))}
          {(ac.loading || ac.loadingMore) && (
            <div className="flex justify-center py-2">
              <Spinner className="text-muted-foreground" />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
});

export { InputSuggest };
