import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Параметры запроса к {@link ResourceConfig.load}. */
interface ResourceLoadParams {
  /** Поисковый запрос (для async-фильтрации). */
  search?: string;
  /** Номер страницы (1-based) для пагинации. */
  page?: number;
  /** Размер страницы. */
  pageSize?: number;
  /** Дополнительные пользовательские параметры. */
  [key: string]: unknown;
}

/** Один элемент, возвращаемый {@link ResourceConfig.load}. */
interface ResourceItem<T> {
  /** Уникальный ключ элемента (для React `key`). */
  id: string | number;
  /** Видимая подпись опции. */
  label: string;
  /** Значение, которое попадает в `onChange` (всегда приводится к строке). */
  value: T;
  /** Опциональное имя группы — варианты с одинаковым `group` объединяются в `SelectGroup`. */
  group?: string;
  /** Дополнительные поля бек-данных. */
  [key: string]: unknown;
}

/** Ответ {@link ResourceConfig.load}. */
interface ResourceResult<T> {
  /** Список вариантов. */
  items: ResourceItem<T>[];
  /** Общее число доступных вариантов (для пагинации). */
  totalCount: number;
}

/** Конфигурация асинхронного источника опций для {@link Select}. */
export interface ResourceConfig<T> {
  /**
   * Стратегия загрузки:
   * - `'static'` — варианты загружаются один раз и больше не меняются;
   * - `'preload'` — загрузка на маунт компонента (используется по умолчанию в {@link Select});
   * - `'partial'` — порционная загрузка (нужен будет внешний механизм пагинации).
   */
  type: 'static' | 'preload' | 'partial';
  /** Функция загрузки опций. Должна вернуть `{ items, totalCount }`. */
  load: (params?: ResourceLoadParams) => Promise<ResourceResult<T>>;
}

/** Props компонента {@link Select}. */
export interface SelectProps<T> extends Omit<
  React.ComponentProps<typeof SelectPrimitive.Root>,
  'value' | 'onValueChange'
> {
  /** Дополнительный CSS-класс для триггера. */
  className?: string;
  /** Выбранное значение. Всегда строка из `option.value`. `null` — ничего не выбрано. */
  value?: string | null;
  /** Обработчик выбора. При нажатии на крестик (`clearable`) приходит `null`. */
  onChange?: (value: string | null) => void;
  /** Срабатывает при закрытии дропдауна (через `onOpenChange(false)`). */
  onBlur?: () => void;
  /** Асинхронный источник опций. Если задан вместе с `options`, приоритет у `options`. */
  resource?: ResourceConfig<T>;
  /**
   * Inline-варианты. `value` приводится к строке. Опции с одинаковым `group`
   * объединяются в `SelectGroup` с `SelectLabel` (см. рецепт grouped options).
   */
  options?: Array<{ value: string | number; label: string; group?: string }>;
  /** Подсказка в триггере. По умолчанию `'Select an option...'`. */
  placeholder?: string;
  /** Блокирует выбор. */
  disabled?: boolean;
  /** Показывать ли кнопку очистки (X) справа от значения. По умолчанию `false`. */
  clearable?: boolean;
}

/**
 * Выпадающий список на `@radix-ui/react-select`. Поддерживает два режима
 * источника данных: inline `options` и async `resource`. При `clearable=true`
 * показывает крестик для сброса значения в `null`.
 *
 * @example Inline-options
 * ```tsx
 * import { Select } from '@reformer/ui-kit';
 *
 * <Select
 *   value={loanType}
 *   onChange={setLoanType}
 *   placeholder="Тип кредита"
 *   options={[
 *     { value: 'consumer', label: 'Потребительский' },
 *     { value: 'mortgage', label: 'Ипотека' },
 *     { value: 'auto', label: 'Авто' },
 *   ]}
 * />
 * ```
 *
 * @example Grouped options
 * ```tsx
 * import { Select } from '@reformer/ui-kit';
 *
 * <Select
 *   value={city}
 *   onChange={setCity}
 *   options={[
 *     { value: 'msk', label: 'Москва', group: 'Россия' },
 *     { value: 'spb', label: 'Санкт-Петербург', group: 'Россия' },
 *     { value: 'minsk', label: 'Минск', group: 'Беларусь' },
 *   ]}
 * />
 * ```
 */
const Select = React.forwardRef<
  HTMLButtonElement,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SelectProps<any> & { 'data-testid'?: string; 'aria-invalid'?: boolean | 'true' | 'false' }
>(
  (
    {
      className,
      value,
      onChange,
      onBlur,
      resource,
      options: directOptions,
      placeholder,
      disabled,
      clearable = false,
      'data-testid': dataTestId,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const [resourceOptions, setResourceOptions] = React.useState<
      Array<{ id: string | number; label: string; value: string; group?: string }>
    >([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
      if (resource) {
        setLoading(true);
        resource
          .load({})
          .then((response) => {
            setResourceOptions(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              response.items.map((item: any) => ({
                id: item.id,
                label: item.label,
                value: String(item.value),
                group: item.group,
              }))
            );
          })
          .catch(() => setResourceOptions([]))
          .finally(() => setLoading(false));
      }
    }, [resource]);

    // Используем прямые опции или опции из ресурса
    const options = React.useMemo(() => {
      if (directOptions) {
        return directOptions.map((opt) => ({
          id: opt.value,
          label: opt.label,
          value: String(opt.value),
          group: opt.group,
        }));
      }
      return resourceOptions;
    }, [directOptions, resourceOptions]);

    const handleValueChange = (newValue: string) => {
      onChange?.(newValue);
    };

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        onBlur?.();
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(null);
    };

    const showClearButton = clearable && value && !disabled && !loading;

    return (
      <div className="relative w-full">
        <SelectPrimitive.Root
          data-slot="select"
          value={value || ''}
          onValueChange={handleValueChange}
          onOpenChange={handleOpenChange}
          disabled={disabled || loading}
          {...props}
        >
          <SelectTrigger
            ref={ref}
            className={cn(className, showClearButton && 'pr-8')}
            disabled={loading}
            data-testid={dataTestId}
            aria-invalid={ariaInvalid}
          >
            <SelectValue
              placeholder={loading ? 'Loading...' : placeholder || 'Select an option...'}
            />
          </SelectTrigger>
          <SelectContent>
            {loading ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading...</div>
            ) : options.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No options available</div>
            ) : (
              (() => {
                const groupedOptions = options.reduce(
                  (groups, option) => {
                    const group = option.group || 'default';
                    if (!groups[group]) {
                      groups[group] = [];
                    }
                    groups[group].push(option);
                    return groups;
                  },
                  {} as Record<string, typeof options>
                );

                return Object.entries(groupedOptions).map(([groupName, groupOptions]) => (
                  <SelectGroup key={groupName}>
                    {groupName !== 'default' && <SelectLabel>{groupName}</SelectLabel>}
                    {groupOptions.map((option) => (
                      <SelectItem key={option.id} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ));
              })()
            )}
          </SelectContent>
        </SelectPrimitive.Root>

        {/* Clear button */}
        {showClearButton && (
          <button
            type="button"
            className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors bg-transparent border-none p-0 cursor-pointer focus:outline-none z-10"
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

Select.displayName = 'Select';

/**
 * Группа `<SelectItem>` с заголовком {@link SelectLabel}. Тонкая обёртка над
 * `Radix.Select.Group`. Используется при ручной сборке кастомного дропдауна
 * вместо `options`-проп `Select`.
 *
 * @example Группа с заголовком
 * ```tsx
 * import { SelectGroup, SelectLabel, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectGroup>
 *   <SelectLabel>Фрукты</SelectLabel>
 *   <SelectItem value="apple">Яблоко</SelectItem>
 *   <SelectItem value="pear">Груша</SelectItem>
 * </SelectGroup>
 * ```
 *
 * @example Несколько групп подряд внутри SelectContent
 * ```tsx
 * import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@reformer/ui-kit/select';
 *
 * <Select value={city} onChange={setCity}>
 *   <SelectTrigger><SelectValue placeholder="Город" /></SelectTrigger>
 *   <SelectContent>
 *     <SelectGroup>
 *       <SelectLabel>Россия</SelectLabel>
 *       <SelectItem value="msk">Москва</SelectItem>
 *     </SelectGroup>
 *     <SelectGroup>
 *       <SelectLabel>Беларусь</SelectLabel>
 *       <SelectItem value="minsk">Минск</SelectItem>
 *     </SelectGroup>
 *   </SelectContent>
 * </Select>
 * ```
 */
function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

/**
 * Отображает выбранное значение внутри {@link SelectTrigger}. Обёртка над
 * `Radix.Select.Value`. Поддерживает `placeholder` для пустого состояния.
 *
 * @example Стандартный placeholder
 * ```tsx
 * import { SelectTrigger, SelectValue } from '@reformer/ui-kit/select';
 *
 * <SelectTrigger>
 *   <SelectValue placeholder="Выберите вариант" />
 * </SelectTrigger>
 * ```
 *
 * @example Кастомное представление выбранного значения через children
 * ```tsx
 * import { SelectTrigger, SelectValue } from '@reformer/ui-kit/select';
 *
 * <SelectTrigger>
 *   <SelectValue placeholder="Не выбрано">
 *     {value && <span className="font-bold">{value}</span>}
 *   </SelectValue>
 * </SelectTrigger>
 * ```
 */
function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

/**
 * Кнопка-открывалка списка для {@link Select}. Обёртка над
 * `Radix.Select.Trigger` с дефолтными стилями (h-9, rounded, border) и
 * `ChevronDown` справа.
 *
 * @example Дефолтный размер
 * ```tsx
 * import { SelectTrigger, SelectValue } from '@reformer/ui-kit/select';
 *
 * <SelectTrigger>
 *   <SelectValue placeholder="Выберите страну" />
 * </SelectTrigger>
 * ```
 *
 * @example Компактный (size='sm')
 * ```tsx
 * import { SelectTrigger, SelectValue } from '@reformer/ui-kit/select';
 *
 * <SelectTrigger size="sm" className="w-32">
 *   <SelectValue placeholder="Сорт." />
 * </SelectTrigger>
 * ```
 */
function SelectTrigger({
  className,
  size = 'default',
  children,
  'aria-label': ariaLabel,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      aria-label={ariaLabel || 'Select an option'}
      className={cn(
        'h-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-xs transition-colors',
        '!bg-white !text-black',
        'placeholder:text-muted-foreground data-[placeholder]:text-gray-500',
        'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'flex items-center justify-between gap-2',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-gray-500",
        className
      )}
      style={{ backgroundColor: 'white', color: 'black' }}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/**
 * Дропдаун-контент {@link Select} (попап со списком). Обёртка над
 * `Radix.Select.Content` с порталом, скролл-кнопками сверху/снизу и
 * `position='popper'` по умолчанию (растягивается под ширину триггера).
 *
 * @example Popper-режим (default — ширина равна триггеру)
 * ```tsx
 * import { SelectContent, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectContent>
 *   <SelectItem value="a">A</SelectItem>
 *   <SelectItem value="b">B</SelectItem>
 * </SelectContent>
 * ```
 *
 * @example Item-aligned (контент центрируется по выбранному элементу)
 * ```tsx
 * import { SelectContent, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectContent position="item-aligned">
 *   {LONG_LIST.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
 * </SelectContent>
 * ```
 */
function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-white text-black shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className
        )}
        style={position === 'popper' ? { width: 'var(--radix-select-trigger-width)' } : undefined}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className={cn('p-1', position === 'popper' && 'w-full')}>
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/**
 * Заголовок секции внутри {@link SelectGroup}. Обёртка над
 * `Radix.Select.Label`. Не выбирается; используется для визуального разделения
 * групп.
 *
 * @example Простая подпись группы
 * ```tsx
 * import { SelectGroup, SelectLabel, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectGroup>
 *   <SelectLabel>Овощи</SelectLabel>
 *   <SelectItem value="potato">Картошка</SelectItem>
 * </SelectGroup>
 * ```
 *
 * @example Кастомный класс заголовка
 * ```tsx
 * import { SelectGroup, SelectLabel } from '@reformer/ui-kit/select';
 *
 * <SelectGroup>
 *   <SelectLabel className="text-blue-600 font-bold">Премиум</SelectLabel>
 * </SelectGroup>
 * ```
 */
function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn('text-muted-foreground px-2 py-1.5 text-xs', className)}
      {...props}
    />
  );
}

/**
 * Один пункт списка {@link Select}. Обёртка над `Radix.Select.Item` с
 * чекмарком-индикатором (`CheckIcon`) для выбранного варианта.
 *
 * @example Простой пункт
 * ```tsx
 * import { SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectItem value="apple">Яблоко</SelectItem>
 * ```
 *
 * @example Заблокированный пункт
 * ```tsx
 * import { SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectItem value="premium" disabled>
 *   Premium (требуется подписка)
 * </SelectItem>
 * ```
 */
function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-3 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

/**
 * Кнопка-стрелка для скролла вверх в дропдауне {@link SelectContent}.
 * `SelectContent` добавляет её автоматически, экспорт нужен для случаев
 * полностью кастомной сборки.
 *
 * @example Автоматическое добавление SelectContent
 * ```tsx
 * import { SelectContent, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectContent>
 *   <SelectItem value="a">A</SelectItem>
 * </SelectContent>
 * ```
 *
 * @example Ручное использование (кастомная сборка дропдауна)
 * ```tsx
 * import { SelectScrollUpButton } from '@reformer/ui-kit/select';
 *
 * <SelectScrollUpButton className="bg-gray-50 text-gray-600" />
 * ```
 */
function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

/**
 * Кнопка-стрелка для скролла вниз в дропдауне {@link SelectContent}.
 * `SelectContent` добавляет её автоматически, экспорт нужен для случаев
 * полностью кастомной сборки.
 *
 * @example Автоматическое добавление SelectContent
 * ```tsx
 * import { SelectContent, SelectItem } from '@reformer/ui-kit/select';
 *
 * <SelectContent>
 *   <SelectItem value="a">A</SelectItem>
 * </SelectContent>
 * ```
 *
 * @example Ручное использование (кастомная сборка дропдауна)
 * ```tsx
 * import { SelectScrollDownButton } from '@reformer/ui-kit/select';
 *
 * <SelectScrollDownButton className="bg-gray-50 text-gray-600" />
 * ```
 */
function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
};
