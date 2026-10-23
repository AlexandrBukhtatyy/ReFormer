/**
 * Вид «События» журнала: лента записей, которые оставили оболочка и плагины.
 *
 * Строка — время, уровень, кто писал и переведённое сообщение. Подробности (`detail`: текст
 * исключения, стек) свёрнуты и раскрываются кнопкой в строке: ленту читают по сообщениям,
 * а стек в двадцать строк, раскрытый по умолчанию, вытеснил бы из низкого дока всё остальное.
 *
 * ## Сообщение переводит словарь оболочки
 *
 * Ключ записи — полный: голый переводит словарь оболочки, ключ с владельцем — словарь
 * плагина-владельца. Решает служба словаря (`reformer.host.messages`), журнал передаёт ключ
 * как есть. Поэтому запись, сделанная до смены языка, после неё звучит на новом.
 *
 * @module plugins/base/journal/ui/EventsView
 */

import { useMemo, useState, type ReactElement } from 'react';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@reformer/ui-kit/item';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import type { LogEntry, ResourceId } from '@reformer/builder-plugin-api';
import { newestFirst } from '../events';
import type { JournalHost, Translate } from '../host';
import { SEVERITY_CLASS, SEVERITY_ICON, useIdentity } from './ProblemsView';

export interface EventsViewProps {
  readonly host: JournalHost;
  /** Записи в порядке поступления — снимок службы журнала. */
  readonly entries: readonly LogEntry[];
}

export function EventsView({ host, entries }: EventsViewProps): ReactElement {
  const t = host.useTranslate();
  const useMessage = host.useHostMessage ?? useIdentity;
  const message = useMessage();
  const formatTime = host.useFormatTime();
  // Снимок службы стабилен между изменениями, поэтому разворот считается по изменению,
  // а не на каждую перерисовку родителя.
  const rows = useMemo(() => newestFirst(entries), [entries]);

  if (rows.length === 0) {
    return (
      <Empty className="flex-1 border-0">
        <EmptyHeader>
          <EmptyTitle className="text-sm font-medium">{t('events.empty.title')}</EmptyTitle>
          <EmptyDescription className="text-xs">{t('events.empty.description')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ItemGroup role="list" aria-label={t('events.list')}>
        {rows.map((entry) => (
          <EventRow
            key={entry.id}
            entry={entry}
            message={message}
            time={formatTime(entry.time)}
            onOpen={host.openResource}
            t={t}
          />
        ))}
      </ItemGroup>
    </ScrollArea>
  );
}

function EventRow({
  entry,
  message,
  time,
  onOpen,
  t,
}: {
  entry: LogEntry;
  message: Translate;
  time: string;
  onOpen?: (id: ResourceId) => void;
  t: Translate;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const Icon = SEVERITY_ICON[entry.level];
  const resource = entry.resource;
  const open = onOpen !== undefined && resource !== undefined ? () => onOpen(resource) : undefined;

  return (
    <Item
      size="sm"
      role="listitem"
      data-level={entry.level}
      className={`items-start gap-1.5 rounded-none px-3 py-1 text-[12px] ${
        open === undefined ? '' : 'hover:bg-accent/50 cursor-pointer'
      }`}
      // Переход к ресурсу — щелчком по строке, как в виде «Проблемы»: внутри строки своя
      // разметка, и кнопкой её не сделать.
      onClick={open}
    >
      <ItemMedia className="size-4 pt-0.5" role="img" aria-label={t(`level.${entry.level}`)}>
        <Icon className={`size-3.5 ${SEVERITY_CLASS[entry.level]}`} />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0">
        <ItemTitle className="text-[12px] font-normal">
          {message(entry.messageKey, entry.params)}
        </ItemTitle>
        <ItemDescription className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
          <time dateTime={new Date(entry.time).toISOString()} className="tabular-nums">
            {time}
          </time>
          <Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
            {entry.source}
          </Badge>
        </ItemDescription>
        {expanded && entry.detail !== undefined && (
          <pre
            data-detail=""
            className="bg-muted text-muted-foreground mt-1 max-h-48 overflow-auto rounded-sm p-1.5 font-mono text-[10px] whitespace-pre-wrap"
          >
            {entry.detail}
          </pre>
        )}
      </ItemContent>
      {entry.detail !== undefined && (
        <ItemActions>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            aria-expanded={expanded}
            onClick={(event) => {
              // Раскрытие подробностей — не переход: строка с ресурсом иначе увела бы к файлу.
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
          >
            {t(expanded ? 'events.detail.hide' : 'events.detail.show')}
          </Button>
        </ItemActions>
      )}
    </Item>
  );
}
