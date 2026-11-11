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
 * @module plugins/forms/ai/ui/MessageList
 */

import { useRef, useState, type ReactElement } from 'react';
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
import type { ChatEntry, ToolLogEntry } from '../session/session';
import { AttachmentChips } from './AttachmentChips';
import { QuestionCard } from './QuestionCard';
import { timelineOf } from './timeline';
import { useStickToBottom } from './useStickToBottom';
import type { FormAskAnswer } from '@reformer/builder-plugin-api';

export interface MessageListProps {
  readonly entries: readonly ChatEntry[];
  /** Идёт ход: показать индикатор в конце ленты. */
  readonly running: boolean;
  readonly t: Translate;
  /** Вернуть форму к состоянию перед репликой. */
  readonly onRestore: (entryId: string) => void;
  /** Карточка вопросов, ждущая ответа, — по ней карточка становится формой. */
  readonly openAsk: string | null;
  /** Ответить на карточку вопросов модели. */
  readonly onAnswer: (cardId: string, answers: readonly FormAskAnswer[]) => void;
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
      <CollapsibleTrigger
        data-testid="ai-reasoning-toggle"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11.5px] leading-4"
      >
        <ChevronRight
          className={`size-3 flex-none transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {t('chat.reasoning')}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Предел высоты — на ВЬЮПОРТЕ, а не на корне или обёртке: вьюпорт берёт высоту у
            корня процентом, а процент от высоты, которая сама считается по содержимому, не
            разрешается — вьюпорт рос до полного текста и ложился поверх ответа. Обёртку
            содержимого, которую Radix делает таблицей, блок переводит в обычный блок: таблица
            растёт по самому длинному слову, и неразрывный токен расширял блок вбок. */}
        <ScrollArea
          data-testid="ai-reasoning"
          className="border-border border-l-2 [&>[data-slot=scroll-area-viewport]]:max-h-40 [&>[data-slot=scroll-area-viewport]>div]:block!"
        >
          <div className="text-muted-foreground pr-2.5 pl-2 text-[11.5px] leading-4 wrap-anywhere whitespace-pre-wrap">
            {text}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Подряд идущие вызовы инструментов — строками журнала. */
function ToolLines({ tools }: { tools: readonly ToolLogEntry[] }): ReactElement {
  return (
    <ul className="space-y-0.5">
      {tools.map((tool, index) => (
        <li
          key={String(index)}
          data-testid="ai-tool-line"
          data-ok={tool.ok}
          className="text-muted-foreground flex gap-1.5 text-[11.5px] leading-4"
        >
          {tool.ok ? (
            <Check className="mt-px size-3 flex-none text-emerald-600 dark:text-emerald-400" />
          ) : (
            <CircleAlert className="mt-px size-3 flex-none text-amber-600 dark:text-amber-400" />
          )}
          <span className="min-w-0 wrap-anywhere">
            {tool.detail === undefined ? (
              (tool.summary ?? tool.error ?? tool.name)
            ) : (
              // Строка — человеку на его языке, текст модели — по раскрытию (ReFormer-lhvk.7).
              <details data-testid="ai-tool-detail">
                <summary className="cursor-pointer">
                  {tool.summary ?? tool.error ?? tool.name}
                </summary>
                <pre className="mt-0.5 font-mono text-[10.5px] whitespace-pre-wrap">
                  {tool.detail}
                </pre>
              </details>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Над какими репликами пользователя назвать форму хода: над первой и там, где форма сменилась.
 *
 * Не над каждой: в разговоре об одной форме путь над каждым вопросом — шум. Подпись нужна там,
 * где ход пошёл по другой форме, — именно этот момент без неё выглядел как «ассистент пишет не туда».
 */
function formTargets(entries: readonly ChatEntry[]): ReadonlyMap<string, string> {
  const targets = new Map<string, string>();
  let previous: string | undefined;
  for (const entry of entries) {
    const path = entry.snapshot?.path;
    if (entry.role !== 'user' || path === undefined) continue;
    if (path !== previous) targets.set(entry.id, path);
    previous = path;
  }
  return targets;
}

/** Лента диалога: держится у конца, пока человек не ушёл читать выше (`./useStickToBottom`). */
export function MessageList({
  entries,
  running,
  t,
  onRestore,
  openAsk,
  onAnswer,
}: MessageListProps): ReactElement {
  const feedRef = useRef<HTMLDivElement>(null);
  const asked = entries.filter((entry) => entry.role === 'user').length;
  useStickToBottom(feedRef, entries.length > 0, entries, asked);

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

  const targets = formTargets(entries);
  const runningForm = [...entries].reverse().find((entry) => entry.snapshot?.path)?.snapshot?.path;

  return (
    // Обёртку содержимого Radix делает таблицей — она растёт по самому длинному слову, и одна
    // неразрывная строка расширяла всю ленту: реплики уезжали за правый край. Блок держит ширину.
    <ScrollArea
      ref={feedRef}
      data-testid="ai-feed"
      className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]>div]:block!"
    >
      <MessageGroup className="gap-3 px-3 py-3">
        {entries.map((entry) => (
          <div key={entry.id} data-testid="ai-entry" data-role={entry.role} className="space-y-1.5">
            {targets.has(entry.id) && (
              <div
                data-testid="ai-entry-target"
                className="text-muted-foreground truncate text-end text-[10.5px] leading-4"
              >
                {t('chat.target.entry', { path: targets.get(entry.id) })}
              </div>
            )}
            {entry.reasoning !== '' && <Reasoning text={entry.reasoning} t={t} />}

            {entry.role === 'user' ? (
              <>
                {entry.text !== '' && (
                  <Message align="end">
                    <MessageContent
                      data-testid="ai-message"
                      className="bg-muted rounded-md px-2.5 py-1.5 text-[12.5px] leading-5 wrap-anywhere whitespace-pre-wrap"
                    >
                      {entry.text}
                      {entry.snapshot !== undefined && (
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
                {entry.attachments !== undefined && (
                  <AttachmentChips
                    attachments={entry.attachments}
                    t={t}
                    className="justify-end gap-1.5 py-0"
                  />
                )}
              </>
            ) : (
              // Блоки — в порядке хода (`./timeline`): пояснение над вызовом, к которому оно
              // относится, итог — под журналом правок, вопрос — там, где модель его задала.
              // Пустая реплика — обычное начало хода: текст может появиться только в конце.
              timelineOf(entry).map((block, index) => {
                const key = `${entry.id}-${String(index)}`;
                switch (block.kind) {
                  case 'text':
                    return (
                      <Message key={key} align="start">
                        <MessageContent
                          data-testid="ai-message"
                          className="text-foreground text-[12.5px] leading-5 wrap-anywhere whitespace-pre-wrap"
                        >
                          {block.text}
                        </MessageContent>
                      </Message>
                    );
                  case 'tools':
                    return <ToolLines key={key} tools={block.tools} />;
                  case 'ask':
                    return (
                      <QuestionCard
                        key={block.card.id}
                        card={block.card}
                        open={block.card.id === openAsk}
                        t={t}
                        onAnswer={(answers) => {
                          onAnswer(block.card.id, answers);
                        }}
                      />
                    );
                }
              })
            )}
          </div>
        ))}

        {running && (
          <div
            data-testid="ai-working"
            className="text-muted-foreground flex items-center gap-1.5 text-[11.5px]"
          >
            <Spinner className="size-3" />
            {runningForm !== undefined
              ? t('chat.working.form', { path: runningForm })
              : t('chat.working')}
          </div>
        )}
      </MessageGroup>
    </ScrollArea>
  );
}
