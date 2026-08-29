/**
 * Палитра компонентов: разделы каталога и добавление узла щелчком.
 *
 * Разделы, подписи и поиск считает {@link paletteSections} — чистая функция над каталогом
 * активного кита. Здесь только отрисовка и решение «куда встанет добавленное»
 * ({@link placementFor}), которое тоже чистое и живёт отдельно: тем же правилом пользуется
 * будущий дроп, и вторая его копия разошлась бы с первой на визарде.
 *
 * ## Щелчок и перетаскивание — два способа, а не один вместо другого
 *
 * Щелчок добавляет узел в выделенный контейнер (или следом за выделенным полем): он работает
 * с клавиатуры и не требует попадания мышью в трёхпиксельную щель между строками.
 * Перетаскивание показывает место точно и потому нужно там, где выделено не то, куда кладут.
 * Оба идут одной операцией `insert`; расходятся они ровно в том, кто называет место, —
 * {@link placementFor} по выделению или {@link './drag'.planDrop} по строке под курсором.
 *
 * Груз кладётся в сеанс перетаскивания, а не в `dataTransfer`: канвас читает его на `dragover`,
 * где `dataTransfer` не читается вовсе (см. `./drag-session`).
 *
 * @module plugins/editor-schema/ui/PalettePanel
 */

import { useMemo, useState, type ReactElement } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@reformer/ui-kit/collapsible';
import { Empty, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import { Input } from '@reformer/ui-kit/input';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { DRAG_MIME, type DragSession } from '../drag-session';
import { insertOp } from '../ops';
import { placementFor } from '../placement';
import {
  DEFAULT_COLLAPSED_CATEGORIES,
  paletteNode,
  paletteSections,
  type PaletteEntry,
} from '../palette-model';
import { useActiveSession, useSessionState } from './useSession';
import type { SchemaEditorHost } from '../host';
import type { SessionRegistry } from '../sessions';
import { useCatalog } from './useCatalog';

export interface PalettePanelProps {
  readonly host: SchemaEditorHost;
  readonly registry: SessionRegistry;
  /** Сеанс перетаскивания — общий с канвасом. Без него палитра работает щелчком. */
  readonly drag?: DragSession | null;
}

export function PalettePanel({ host, registry, drag = null }: PalettePanelProps): ReactElement {
  const t = host.useTranslate();
  const session = useActiveSession(registry);
  const state = useSessionState(registry, session);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(DEFAULT_COLLAPSED_CATEGORIES)
  );

  const catalog = useCatalog(host);
  const order = host.categoryOrder?.();
  const sections = useMemo(
    () => paletteSections(catalog, { order, query }),
    [catalog, order, query]
  );

  const add = (item: PaletteEntry): void => {
    if (session === null || state === null) return;
    session.apply(insertOp(paletteNode(item), placementFor(state.model, state.selection)));
  };

  const disabled = session === null || state === null || state.syncState === 'diverged';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="p-2">
        <Input
          value={query}
          placeholder={t('palette.search')}
          aria-label={t('palette.search')}
          className="h-7 text-[12px]"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {sections.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyTitle className="text-sm font-medium">{t('palette.empty')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          sections.map((section) => (
            <Collapsible
              key={section.category}
              // Поиск раскрывает всё: свёрнутый раздел с найденным внутри выглядит как
              // «не нашлось», хотя нашлось.
              open={query !== '' || !collapsed.has(section.category)}
              onOpenChange={(open) => {
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (open) next.delete(section.category);
                  else next.add(section.category);
                  return next;
                });
              }}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full justify-start gap-1 rounded-none px-2 text-[12px] font-medium"
                >
                  {query !== '' || !collapsed.has(section.category) ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                  {section.category}
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {section.items.length}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {section.items.map((item) => (
                  <Button
                    key={item.name}
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-label={t('palette.add', { name: item.label })}
                    className="h-7 w-full justify-start rounded-none pl-7 text-[12px] font-normal"
                    // Узел собирается на СТАРТЕ перетаскивания, а не на броске: канвас обязан
                    // ответить «сюда можно» уже на первом `dragover`, а для этого груз должен
                    // существовать. Адреса узел получит при вставке — операция выдаёт их сама.
                    draggable={drag !== null && !disabled}
                    onDragStart={(event) => {
                      if (drag === null || disabled) {
                        event.preventDefault();
                        return;
                      }
                      drag.begin({ kind: 'new', node: paletteNode(item) });
                      event.dataTransfer.setData(DRAG_MIME, item.name);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDragEnd={() => {
                      drag?.end();
                    }}
                    onClick={() => {
                      add(item);
                    }}
                  >
                    {item.label}
                    {item.variant !== undefined && (
                      <span className="text-muted-foreground ml-1 text-[10px]">{item.variant}</span>
                    )}
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
