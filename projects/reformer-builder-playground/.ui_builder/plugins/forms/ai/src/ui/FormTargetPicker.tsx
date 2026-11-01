/**
 * «Правит: …» над полем ввода — какую форму правит следующий ход, и выбор этой формы.
 *
 * Ход работает с формой, закреплённой здесь, а без закрепления — с формой активной вкладки или
 * файла её модуля (`AgentBridge.targetForm`). Подпись показывает это ДО отправки запроса, а щелчок
 * открывает список форм проекта: выбранная форма закрепляется и держится между репликами, пока её
 * не снимут крестиком, пунктом «По активной вкладке» или новым разговором.
 *
 * Закреплённая форма выделена: она важнее вкладки, и человек, забывший о закреплении, иначе ждал
 * бы правку в форме, которую видит.
 *
 * @module plugins/forms/ai/ui/FormTargetPicker
 */

import { useEffect, useState, type ReactElement } from 'react';
import { ChevronDown, Pin, X } from 'lucide-react';
import type { FormListing } from '@reformer/builder-plugin-api';
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
import { useTargetForm } from './useTargetForm';

/** Значение пункта «По активной вкладке» — не путь формы. */
const AUTO = '__auto__';

export interface FormTargetPickerProps {
  readonly bridge: AgentBridge;
  readonly t: Translate;
  /** Во время хода выбор недоступен: форму хода он не меняет, а человек решил бы, что меняет. */
  readonly disabled?: boolean;
}

export function FormTargetPicker({ bridge, t, disabled }: FormTargetPickerProps): ReactElement {
  const target = useTargetForm(bridge);
  const [open, setOpen] = useState(false);
  const [forms, setForms] = useState<readonly FormListing[] | null>(null);

  // Формы — при каждом открытии: проект меняется, и список, собранный раз, отставал бы.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void bridge.forms().then((found) => {
      if (alive) setForms(found);
    });
    return () => {
      alive = false;
    };
  }, [open, bridge]);

  const pinned = target?.via === 'pinned';
  const label =
    target === null ? t('chat.target.none') : t('chat.target.active', { path: target.path });
  const hint =
    target === null
      ? t('chat.target.choose')
      : pinned
        ? `${target.path}\n${t('chat.target.pinned')}`
        : target.via === 'module'
          ? `${target.path}\n${t('chat.target.module')}`
          : target.path;
  const choose = (resource: FormListing['resource'] | null): void => {
    setOpen(false);
    void bridge.pin(resource);
  };

  return (
    <div className="mb-1 flex min-w-0 items-center gap-0.5">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            data-testid="ai-composer-target"
            data-pinned={pinned ? 'true' : undefined}
            title={hint}
            disabled={disabled}
            className={
              pinned
                ? 'text-foreground h-5 min-w-0 justify-start gap-1 px-1 text-[10.5px] leading-4 font-medium'
                : 'text-muted-foreground h-5 min-w-0 justify-start gap-1 px-1 text-[10.5px] leading-4 font-normal'
            }
          >
            {pinned && <Pin aria-hidden="true" className="size-3 flex-none" />}
            <span className="truncate">{label}</span>
            <ChevronDown aria-hidden="true" className="size-3 flex-none opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="w-80 p-0"
          // Глобальные сочетания оболочки не должны срабатывать при наборе запроса.
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
        >
          <Command label={t('chat.target.choose')}>
            <CommandInput
              placeholder={t('chat.target.search')}
              aria-label={t('chat.target.search')}
            />
            <CommandList className="max-h-64">
              <CommandEmpty>{t('chat.target.empty')}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={AUTO}
                  keywords={[t('chat.target.auto')]}
                  onSelect={() => {
                    choose(null);
                  }}
                >
                  <span className="text-[12px]">{t('chat.target.auto')}</span>
                </CommandItem>
                {(forms ?? []).map((form) => (
                  <CommandItem
                    key={form.path}
                    value={form.path}
                    keywords={[form.name]}
                    data-checked={target?.resource === form.resource ? 'true' : undefined}
                    onSelect={() => {
                      choose(form.resource);
                    }}
                  >
                    <span className="min-w-0 flex-none truncate text-[12px]">{form.name}</span>
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-[11px]">
                      {form.path}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {pinned && (
        <Button
          variant="ghost"
          size="icon-xs"
          title={t('chat.target.unpin')}
          aria-label={t('chat.target.unpin')}
          disabled={disabled}
          className="size-4 flex-none"
          onClick={() => {
            void bridge.pin(null);
          }}
        >
          <X aria-hidden="true" className="size-3" />
        </Button>
      )}
    </div>
  );
}
