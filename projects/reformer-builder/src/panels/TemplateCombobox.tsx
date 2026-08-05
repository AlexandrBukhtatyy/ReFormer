/**
 * Выбор шаблона формы — combobox (Popover + Command) с карточкой в списке: имя, описание и бейдж
 * источника. Готовый `Combobox` из ui-kit берёт плоские `{value,label}` и не умеет кастомный рендер
 * пункта, поэтому здесь собран тот же shadcn-рецепт с нужной карточкой.
 *
 * @module reformer-builder/panels/TemplateCombobox
 */

import { useState } from 'react';
import { Badge, Button } from '@reformer/ui-kit';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@reformer/ui-kit/command';
import { Popover, PopoverContent, PopoverTrigger } from '@reformer/ui-kit/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { SOURCE_LABEL, type FormTemplate } from '../templates';
import { cn } from '../lib/cn';

/** Карточка шаблона: имя + описание + бейдж источника. Используется и в списке, и в триггере. */
function TemplateCard({ template, compact }: { template: FormTemplate; compact?: boolean }) {
  return (
    <>
      {/* text-left — Button центрирует содержимое, а карточка должна читаться слева. */}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate font-medium">{template.name}</span>
        {template.description && !compact && (
          <span className="block truncate text-[11px] font-normal text-muted-foreground">
            {template.description}
          </span>
        )}
      </span>
      <Badge variant="secondary" className="h-4 flex-none px-1.5 text-[9px]">
        {SOURCE_LABEL[template.source]}
      </Badge>
    </>
  );
}

export function TemplateCombobox({
  templates,
  value,
  onChange,
  id,
}: {
  templates: FormTemplate[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = templates.find((t) => t.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto w-full justify-between gap-2 py-1.5 font-normal"
        >
          {selected ? (
            <TemplateCard template={selected} compact />
          ) : (
            <span className="flex-1 truncate text-left text-muted-foreground">
              Выберите шаблон…
            </span>
          )}
          <ChevronsUpDown className="size-4 flex-none opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder="Поиск шаблона…" />
          <CommandList>
            <CommandEmpty>Шаблоны не найдены.</CommandEmpty>
            <CommandGroup>
              {templates.map((t) => (
                <CommandItem
                  key={t.id}
                  // cmdk фильтрует по value — подставляем видимый текст, чтобы поиск шёл по нему.
                  value={`${t.name} ${t.description ?? ''}`}
                  onSelect={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className="items-start gap-2"
                >
                  <Check
                    className={cn(
                      'mt-0.5 size-4 flex-none',
                      t.id === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <TemplateCard template={t} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
