/**
 * Пикер ресурсов — скрепка у поля ввода: поиск по провайдерам ресурсов и прикрепление к реплике.
 *
 * Ищут провайдеры (`AssistantResourceProvider.search`), а не пикер: что считать ресурсом и как
 * его найти, знает тот, кто его даёт. Пикер только спрашивает — с задержкой на ввод и обрывом
 * прежнего запроса, — и показывает найденное группами по схеме.
 *
 * Без провайдеров, умеющих искать, скрепки нет: кнопка, за которой пусто, хуже её отсутствия.
 *
 * @module plugins/forms/ai/ui/ResourcePicker
 */

import { useEffect, useState, type ReactElement } from 'react';
import { Paperclip } from 'lucide-react';
import { Button } from '@reformer/ui-kit/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@reformer/ui-kit/command';
import { Popover, PopoverContent, PopoverTrigger } from '@reformer/ui-kit/popover';
import type { Translate } from '../host';
import type { AgentBridge } from '../session/bridge';
import type { ResourceSearchGroup } from '../session/resources';

/** Пауза между нажатием и запросом: обход проекта не должен идти на каждую букву. */
const SEARCH_DELAY_MS = 150;

export interface ResourcePickerProps {
  readonly bridge: AgentBridge;
  readonly t: Translate;
  readonly disabled?: boolean;
}

export function ResourcePicker({ bridge, t, disabled }: ResourcePickerProps): ReactElement | null {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<readonly ResourceSearchGroup[]>([]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void bridge.searchResources(query, controller.signal).then((found) => {
        if (!controller.signal.aborted) setGroups(found);
      });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, bridge]);

  if (!bridge.canSearchResources()) return null;

  const close = (): void => {
    setOpen(false);
    setQuery('');
  };
  const shown = groups.filter((group) => group.entries.length > 0);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else close();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title={t('chat.attach')}
          aria-label={t('chat.attach')}
          disabled={disabled}
        >
          <Paperclip />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-72 p-0"
        // Глобальные сочетания оболочки не должны срабатывать при наборе запроса.
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
      >
        <Command label={t('chat.attach')} shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('chat.attach.search')}
            aria-label={t('chat.attach.search')}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>{t('chat.attach.empty')}</CommandEmpty>
            {shown.map((group) => (
              <CommandGroup
                key={group.scheme}
                {...(shown.length > 1 ? { heading: group.scheme } : {})}
              >
                {group.entries.map((entry) => (
                  <CommandItem
                    key={entry.uri}
                    value={entry.uri}
                    onSelect={() => {
                      bridge.attach({ uri: entry.uri, name: entry.name });
                      close();
                    }}
                  >
                    <span className="min-w-0 flex-none truncate text-[12px]">{entry.name}</span>
                    {entry.description !== undefined && (
                      <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-[11px]">
                        {entry.description}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
