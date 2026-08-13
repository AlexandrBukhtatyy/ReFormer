/**
 * Лента диалога: реплики и видимые вызовы инструментов.
 *
 * Вызовы показываются как действия («Добавлено поле Email»), а не как JSON: сырой вызов ничего не
 * объясняет пользователю, а объяснять — единственная причина их показывать.
 *
 * @module reformer-builder/panels/agent/MessageList
 */

import { useEffect, useRef } from 'react';
import { CircleAlert, Check, Sparkles } from 'lucide-react';
import { ScrollArea } from '@reformer/ui-kit';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@reformer/ui-kit/empty';
import { Spinner } from '@reformer/ui-kit/spinner';
import type { ChatEntry } from '../../agent/session';
import { cn } from '../../lib/cn';

/** Свойства ленты. */
export interface MessageListProps {
  entries: readonly ChatEntry[];
  /** Идёт ход: показать индикатор у последней реплики. */
  running: boolean;
}

/** Лента диалога с автопрокруткой к концу. */
export function MessageList({ entries, running }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Прокрутка к концу — DOM-эффект, зависящий от объёма ленты и хода.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries, running]);

  if (!entries.length) {
    return (
      <Empty className="flex-1 p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles />
          </EmptyMedia>
          <EmptyDescription className="text-[12px] leading-5">
            Опишите, что нужно сделать с формой: «добавь поле email», «сделай телефон обязательным»,
            «поставь имя и фамилию в одну строку».
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-3 px-3 py-3">
        {entries.map((entry) => (
          <div key={entry.id} className="space-y-1.5">
            <div
              className={cn(
                'whitespace-pre-wrap break-words text-[12.5px] leading-5',
                entry.role === 'user' ? 'rounded-md bg-muted px-2.5 py-1.5' : 'text-foreground'
              )}
            >
              {entry.text}
            </div>

            {entry.tools.length > 0 && (
              <ul className="space-y-0.5">
                {entry.tools.map((tool, i) => (
                  <li
                    key={`${entry.id}-${i}`}
                    className="flex gap-1.5 text-[11.5px] leading-4 text-muted-foreground"
                  >
                    {tool.ok ? (
                      <Check className="mt-px size-3 flex-none text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <CircleAlert className="mt-px size-3 flex-none text-amber-600 dark:text-amber-400" />
                    )}
                    <span className="min-w-0 break-words">
                      {tool.summary ?? tool.error ?? tool.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {running && (
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Spinner className="size-3" />
            Работаю…
          </div>
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
