import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';
import { Separator } from '@/components/separator';

// Порт shadcn/ui (new-york-v4) item. Правки: путь до Separator
// (`@/components/separator`), `@/lib/utils`, роли списка (см. ItemGroup). Апстрим уже на unified
// `radix-ui` (Slot.Root) и уже несёт data-slot на каждой части. cva-стили (variant/size) —
// обычная стилизация внутри реализации, не «варианты» в смысле нашего концепта.

/** Item лежит прямо в списке `ItemGroup` (`role="list"`) и должен быть его элементом. */
const ItemListContext = React.createContext(false);

/**
 * Группа пунктов — список (`role="list"`), её `Item` — элементы списка (`role="listitem"`).
 * В апстриме у группы была роль списка, а у пунктов — никакой: скринридер объявлял пустой
 * список. Свою роль группы (`role="none"` — когда группа лежит внутри дерева или меню, а пункты
 * несут их роли) Item уважает: listitem ставится только внутри `role="list"`.
 */
function ItemGroup({ className, role = 'list', ...props }: React.ComponentProps<'div'>) {
  return (
    <ItemListContext.Provider value={role === 'list'}>
      <div
        role={role}
        data-slot="item-group"
        className={cn('group/item-group flex flex-col', className)}
        {...props}
      />
    </ItemListContext.Provider>
  );
}

function ItemSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn('my-0', className)}
      {...props}
    />
  );
}

const itemVariants = cva(
  'group/item flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-accent/50',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border-border',
        muted: 'bg-muted/50',
      },
      size: {
        default: 'gap-4 p-4',
        sm: 'gap-2.5 px-4 py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Item({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof itemVariants> & { asChild?: boolean }) {
  const inList = React.useContext(ItemListContext);
  const Comp = asChild ? Slot.Root : 'div';
  const item = (
    <Comp
      data-slot="item"
      data-variant={variant}
      data-size={size}
      // Своя разметка пункта в списке — элемент списка. Явный `role` вызывающего важнее.
      role={inList && !asChild ? 'listitem' : undefined}
      className={cn(itemVariants({ variant, size, className }))}
      {...props}
    />
  );
  // С `asChild` пункт — чужой элемент (обычно ссылка): `listitem` на нём стёр бы роль ссылки,
  // поэтому элементом списка становится обёртка без собственного бокса.
  return inList && asChild ? (
    <div role="listitem" data-slot="item-list-item" className="contents">
      {item}
    </div>
  ) : (
    item
  );
}

const itemMediaVariants = cva(
  'flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: "size-8 rounded-sm border bg-muted [&_svg:not([class*='size-'])]:size-4",
        image: 'size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function ItemMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-content"
      className={cn('flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none', className)}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-title"
      className={cn('flex w-fit items-center gap-2 text-sm leading-snug font-medium', className)}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        'line-clamp-2 text-sm leading-normal font-normal text-balance text-muted-foreground',
        '[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        className
      )}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="item-actions" className={cn('flex items-center gap-2', className)} {...props} />
  );
}

function ItemHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-header"
      className={cn('flex basis-full items-center justify-between gap-2', className)}
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-footer"
      className={cn('flex basis-full items-center justify-between gap-2', className)}
      {...props}
    />
  );
}

export {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
  itemVariants,
  itemMediaVariants,
};
