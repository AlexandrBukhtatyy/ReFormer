/**
 * Лента диалога: реплики, рассуждение и видимые вызовы инструментов.
 *
 * Вызовы показываются как действия («Добавлено поле Email»), а не как JSON: сырой вызов ничего
 * не объясняет пользователю, а объяснять — единственная причина их показывать.
 *
 * Собрано на `@reformer/ui-kit`: реплика — `Message`/`MessageContent` (чат-примитивы кита),
 * пустое состояние — `Empty`, рассуждение — `Collapsible`, прокрутка — `ScrollArea`. Голых
 * элементов оформления здесь нет: у кита для каждой роли есть свой компонент, и переписывать
 * его классами значило бы заводить вторую дизайн-систему внутри первой.
 *
 * @module plugins/ai/ui/MessageList
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Check, ChevronRight, CircleAlert, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '@reformer/ui-kit/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@reformer/ui-kit/collapsible';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@reformer/ui-kit/empty';
import { Message, MessageContent, MessageGroup } from '@reformer/ui-kit/message';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { Spinner } from '@reformer/ui-kit/spinner';
import type { Translate } from '../host';
import type { ChatEntry } from '../session';

export interface MessageListProps {
  readonly entries: readonly ChatEntry[];
  /** Идёт ход: показать индикатор в конце ленты. */
  readonly running: boolean;
  readonly t: Translate;
  /** Вернуть форму к состоянию перед репликой. */
  readonly onRestore: (entryId: string) => void;
}

/** Сколько символов запроса показывать в подсказке кнопки восстановления. */
const TITLE_IN_HINT = 40;

/**
 * Рассуждение модели — свёрнутый блок над ответом.
 *
 * Свёрнутый, потому что это черновик мысли: развёрнутым он вытесняет из панели и ответ, и
 * журнал правок. Показывать его всё же надо — у think-моделей это единственное, что приходит
 * до первого вызова инструмента, и на оборванном ходе только оно объясняет, на чём модель встала.
 */
function Reasoning({ text, t }: { text: string; t: Translate }): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-1">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11.5px] leading-4">
        <ChevronRight
          className={`size-3 flex-none transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {t('chat.reasoning')}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Предел высоты держит флекс-обёртка, а не `max-h` на самой `ScrollArea`: вьюпорт
            берёт высоту у корня процентом, а процент от `max-height` при `height: auto`
            не считается — текст вылез бы за рамку, так и не начав прокручиваться. */}
        <div className="flex max-h-40 flex-col">
          <ScrollArea className="border-border min-h-0 flex-1 border-l-2">
            <div className="text-muted-foreground pl-2 text-[11.5px] leading-4 break-words whitespace-pre-wrap">
              {text}
            </div>
          </ScrollArea>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Лента диалога с автопрокруткой к концу. */
export function MessageList({ entries, running, t, onRestore }: MessageListProps): ReactElement {
  const endRef = useRef<HTMLDivElement>(null);

  // Прокрутка к концу — DOM-эффект, зависящий от объёма ленты и хода.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries, running]);

  if (entries.length === 0) {
    return (
      <Empty className="flex-1 p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles />
          </EmptyMedia>
          <EmptyTitle className="text-[12.5px]">{t('chat.empty.title')}</EmptyTitle>
          <EmptyDescription className="text-[12px] leading-5">
            {t('chat.empty.hint')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <MessageGroup className="gap-3 px-3 py-3">
        {entries.map((entry) => (
          <div key={entry.id} className="space-y-1.5">
            {entry.reasoning !== '' && <Reasoning text={entry.reasoning} t={t} />}

            {/* Пустая реплика ассистента — обычное состояние в начале хода: сначала приходит
                рассуждение и вызовы инструментов, текст ответа может появиться только в конце. */}
            {entry.text !== '' && (
              <Message align={entry.role === 'user' ? 'end' : 'start'}>
                <MessageContent
                  className={
                    entry.role === 'user'
                      ? 'bg-muted rounded-md px-2.5 py-1.5 text-[12.5px] leading-5 break-words whitespace-pre-wrap'
                      : 'text-foreground text-[12.5px] leading-5 break-words whitespace-pre-wrap'
                  }
                >
                  {entry.text}
                  {entry.role === 'user' && entry.snapshot !== undefined && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={running}
                      onClick={() => {
                        onRestore(entry.id);
                      }}
                      title={t('chat.restore.hint', {
                        text:
                          entry.text.length > TITLE_IN_HINT
                            ? `${entry.text.slice(0, TITLE_IN_HINT)}…`
                            : entry.text,
                      })}
                      className="text-muted-foreground h-6 self-end px-1.5 text-[10.5px]"
                    >
                      <Undo2 className="size-3" />
                      {t('chat.restore')}
                    </Button>
                  )}
                </MessageContent>
              </Message>
            )}

            {entry.tools.length > 0 && (
              <ul className="space-y-0.5">
                {entry.tools.map((tool, index) => (
                  <li
                    key={`${entry.id}-${String(index)}`}
                    className="text-muted-foreground flex gap-1.5 text-[11.5px] leading-4"
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
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11.5px]">
            <Spinner className="size-3" />
            {t('chat.working')}
          </div>
        )}
        <div ref={endRef} />
      </MessageGroup>
    </ScrollArea>
  );
}
