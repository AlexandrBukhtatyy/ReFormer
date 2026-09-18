import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import type { NormalizedOption } from '../option-source';
import { useAutocompleteContext } from './AutocompleteContext';

/** Props `Autocomplete.Listbox`. */
export interface AutocompleteListboxProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Пункты списка. Render-функция получает текущие подсказки. */
  children?: ReactNode | ((items: NormalizedOption[]) => ReactNode);
  /** Рендерить и при закрытом списке (для анимаций выхода). @default false */
  forceMount?: boolean;
}

/**
 * Autocomplete.Listbox — контейнер подсказок (`role="listbox"`). Рендерится, только пока список
 * раскрыт; позиционирование — через `className`/`style` или внешний Popover.
 */
export const AutocompleteListbox = forwardRef<HTMLDivElement, AutocompleteListboxProps>(
  function AutocompleteListbox({ children, forceMount = false, ...props }, ref) {
    const { open, items, getListboxProps } = useAutocompleteContext();
    if (!open && !forceMount) return null;
    return (
      <div ref={ref} hidden={!open || undefined} {...getListboxProps(props)}>
        {typeof children === 'function' ? children(items) : children}
      </div>
    );
  }
);

AutocompleteListbox.displayName = 'Autocomplete.Listbox';
