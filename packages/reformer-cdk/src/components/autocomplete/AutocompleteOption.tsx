import { forwardRef, type HTMLAttributes } from 'react';
import { Slot } from '../form-wizard/Slot';
import type { NormalizedOption } from '../option-source';
import { useAutocompleteContext } from './AutocompleteContext';

/** Props `Autocomplete.Option`. */
export interface AutocompleteOptionProps extends HTMLAttributes<HTMLDivElement> {
  /** Подсказка из `items`. */
  item: NormalizedOption;
  /** Её индекс в `items` (для подсветки и `aria-activedescendant`). */
  index: number;
  /** Рендерить собственный элемент вместо `<div>`. */
  asChild?: boolean;
}

/**
 * Autocomplete.Option — пункт списка (`role="option"`). Подсвеченный получает `data-active`;
 * без `children` выводит `item.label`.
 */
export const AutocompleteOption = forwardRef<HTMLDivElement, AutocompleteOptionProps>(
  function AutocompleteOption({ item, index, asChild, children, ...props }, ref) {
    const { getOptionProps } = useAutocompleteContext();
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp ref={ref} {...(getOptionProps(item, index, props) as Record<string, unknown>)}>
        {children ?? item.label}
      </Comp>
    );
  }
);

AutocompleteOption.displayName = 'Autocomplete.Option';
