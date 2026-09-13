/**
 * Выбор из списка — третий вид запроса к человеку (`PromptService.pick`).
 *
 * Правила очереди и отмены живут в `../services/prompt`, здесь — окно, поиск и кнопка
 * «убрать». Окно устроено как палитра команд (`../menu/CommandPalette`): тот же `Command` кита
 * с нашим отбором, та же изоляция клавиш, то же место на экране — потому что человек пришёл
 * сюда той же рукой: набрать пару букв и нажать Enter.
 *
 * ## Поиск — правилами палитры
 *
 * Отбор идёт `filterPaletteItems`: подстрока, слова по «и», пояснение тоже участвует. Второе
 * правило поиска в соседнем окне разошлось бы с первым на первом же запросе, который находится
 * в палитре и не находится здесь. Порядок пунктов — порядок запроса (у недавних это свежесть):
 * поиск его не пересчитывает, пока пункты совпадают одинаково.
 *
 * ## «Убрать» — кнопка внутри пункта
 *
 * Щелчок по ней не выбирает пункт и не уводит фокус из поля: человек чистит список, а не
 * уходит из него. Пункт исчезает сразу — ответ спрашивающего на это уже не влияет.
 *
 * @module shell/platform/ui/dialogs/PickPrompt
 */

import {
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';
import { X } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@reformer/ui-kit/command';
import { Dialog, DialogContent, DialogTitle } from '@reformer/ui-kit/dialog';
import type { PendingPrompt } from '@reformer/builder-plugin-api/internal';
import { filterPaletteItems, type ResolvedPaletteItem } from '@/shell/platform/ui/menu/palette';

/** Запрос выбора, ждущий ответа. */
export type PendingPick = Extract<PendingPrompt, { readonly kind: 'pick' }>;

/** Сколько пунктов рисуется — столько же, сколько у палитры. */
const MAX_VISIBLE_ITEMS = 50;

/** Клавиши, которые разбирает список (`cmdk`): до глобального слоя их не пускаем. */
const LIST_KEYS: ReadonlySet<string> = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter']);

export interface PickPromptProps {
  readonly pending: PendingPick;
  /** Локаль — для устойчивого порядка равных совпадений. */
  readonly locale?: string;
  /** Перевод: ключ запроса — словарём спрашивающего, умолчание — словарём Host. */
  readonly translate: (key: string | undefined, fallbackKey: string) => string;
  /** Ответ: идентификатор пункта или `null` — отмена. */
  readonly onClose: (answer: string | null) => void;
}

export function PickPrompt({ pending, locale, translate, onClose }: PickPromptProps): ReactElement {
  const [query, setQuery] = useState('');
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());

  const items = useMemo(() => {
    const resolved: ResolvedPaletteItem[] = [];
    pending.items.forEach((item, index) => {
      if (removed.has(item.id)) return;
      resolved.push({
        id: item.id,
        title: item.label,
        detail: item.description,
        order: index,
        run: () => undefined,
      });
    });
    return filterPaletteItems(resolved, query, locale).slice(0, MAX_VISIBLE_ITEMS);
  }, [pending.items, removed, query, locale]);

  const remove = pending.remove;
  const removeLabel =
    remove === undefined ? '' : translate(remove.labelKey, 'shell.prompt.pick.remove');

  const onRemove = useCallback(
    (id: string) => {
      if (remove === undefined) return;
      setRemoved((previous) => new Set(previous).add(id));
      void Promise.resolve()
        .then(() => remove.run(id))
        .catch((error: unknown) => {
          console.error(`[shell] «убрать» у пункта «${id}» отказало`, error);
        });
    },
    [remove]
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      // Запасной путь: Escape перехватывает Radix раньше — см. `onEscapeKeyDown` ниже.
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose(null);
        return;
      }
      // Навигация и выбор — дело `cmdk`; здесь только изоляция от глобального слоя.
      // `stopPropagation` без `preventDefault`, иначе список перестал бы слушаться стрелок.
      if (LIST_KEYS.has(event.key)) event.stopPropagation();
    },
    [onClose]
  );

  const title = translate(pending.titleKey, pending.titleKey);
  const placeholder =
    pending.placeholderKey === undefined
      ? undefined
      : translate(pending.placeholderKey, pending.placeholderKey);
  // Пустой запрос и пустой список — это «здесь ничего нет», и сказать это должен спрашивающий
  // своими словами. Непустой запрос — «ничего не нашлось», и это слова оболочки.
  const empty =
    query.trim() === '' && pending.emptyKey !== undefined
      ? translate(pending.emptyKey, pending.emptyKey)
      : translate(undefined, 'shell.prompt.pick.empty');

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Escape и щелчок мимо окна равны отмене: у выбора нет исхода по умолчанию.
        if (!open) onClose(null);
      }}
    >
      <DialogContent
        // Крестика нет, как у палитры: он сел бы поверх пояснения у первого пункта.
        showCloseButton={false}
        aria-describedby={undefined}
        onKeyDown={onKeyDown}
        // Escape Radix ловит в фазе погружения, раньше нашего поддерева, — гасим здесь,
        // иначе он доезжал бы до глобального слоя (см. шапку `../menu/CommandPalette`).
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
        }}
        className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Command label={title} shouldFilter={false} className="h-auto">
          <CommandInput
            value={query}
            aria-label={title}
            placeholder={placeholder}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>{empty}</CommandEmpty>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={item.id}
                className="group"
                onSelect={() => {
                  onClose(item.id);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.detail !== undefined && (
                  <span className="text-muted-foreground flex-none text-[11px]">{item.detail}</span>
                )}
                {remove !== undefined && (
                  <button
                    type="button"
                    aria-label={removeLabel}
                    title={removeLabel}
                    className="text-muted-foreground hover:text-foreground flex-none rounded-sm p-0.5 opacity-0 group-hover:opacity-100 group-data-[selected=true]:opacity-100 focus-visible:opacity-100"
                    // Фокус остаётся в поле поиска: человек продолжает набирать или выбирать.
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    // Щелчок — только «убрать»: до пункта он не всплывает и выбором не становится.
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemove(item.id);
                    }}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
