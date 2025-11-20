import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResourceConfig } from 'reformer';

export interface SelectProps<T>
  extends Omit<React.ComponentProps<typeof SelectPrimitive.Root>, 'value' | 'onValueChange'> {
  className?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  resource?: ResourceConfig<T>;
  options?: Array<{ value: string | number; label: string; group?: string }>;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Select = React.forwardRef<HTMLButtonElement, SelectProps<any>>(
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
              response.items.map((item) => ({
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

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
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
      style={{ backgroundColor: 'white', color: 'black', borderColor: '#d1d5db' }}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

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
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn('text-muted-foreground px-2 py-1.5 text-xs', className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
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

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
}

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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
