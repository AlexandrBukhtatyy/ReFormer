/**
 * Панель ассистента — вклад в `panel.right`, рядом с инспектором.
 *
 * Заголовок панели и её место в доке рисует оболочка; здесь только содержимое: лента диалога,
 * предпросмотр застрявшего набора и поле ввода. Настройки канала показываются вместо ленты —
 * своим экраном, а не диалогом: без канала показывать в ленте нечего, и отдельное окно поверх
 * пустоты было бы лишним шагом.
 *
 * Собрано на `@reformer/ui-kit`: `Button`, `Textarea`, `Alert`, `Separator`, `ScrollArea`
 * (внутри ленты) и чат-примитивы `Message`. Голая разметка осталась только там, где у кита
 * подходящего компонента нет вовсе, — это раскладка колонки панели.
 *
 * @module plugins/ai/ui/ChatPanel
 */

import { useEffect, useState, type KeyboardEvent, type ReactElement } from 'react';
import { CircleAlert, Send, Square } from 'lucide-react';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Button } from '@reformer/ui-kit/button';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { Textarea } from '@reformer/ui-kit/textarea';
import { isStale } from '../apply';
import type { AgentBridge } from '../bridge';
import type { AiHost } from '../host';
import type { AiAssistant } from '../plugin';
import type { AiSession } from '../session';
import { ChangePreview } from './ChangePreview';
import { MessageList } from './MessageList';
import { ProviderSettings } from './ProviderSettings';
import { useAiSession } from './useSession';

export interface ChatPanelProps {
  readonly host: AiHost;
  readonly session: AiSession;
  readonly bridge: AgentBridge;
  readonly assistant: AiAssistant;
}

/** Рабочая область ассистента. */
export function ChatPanel({ host, session, bridge, assistant }: ChatPanelProps): ReactElement {
  const t = host.useTranslate();
  const state = useAiSession(session);
  const [draft, setDraft] = useState('');
  // Реестр каналов — обычный объект, а не хранилище с подпиской: перерисовку после подключения
  // панель запрашивает сама. Заводить ради этого второе наблюдаемое состояние не за что —
  // канал меняется ровно в двух местах, и оба здесь.
  const [connected, setConnected] = useState(0);

  // Канал поднимается при первом показе панели: SDK провайдера грузится отдельным чанком, и
  // платить за него должен тот, кто ассистента открыл.
  useEffect(() => {
    void assistant.restore().then(
      () => {
        setConnected((n) => n + 1);
      },
      (error: unknown) => {
        console.warn('[plugins/ai] канал не восстановлен', error);
      }
    );
  }, [assistant]);

  void connected;
  const provider = assistant.providers.firstEditing();
  const running = state.status === 'running';
  // Без канала показывать ленту нечего — сразу открываем настройки.
  const showSettings = state.settingsOpen || provider === undefined;

  const submit = (): void => {
    const text = draft.trim();
    if (text === '' || running || provider === undefined) return;
    setDraft('');
    void bridge.send(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Глобальные сочетания оболочки не должны срабатывать при наборе текста.
    event.stopPropagation();
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  if (showSettings) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <ProviderSettings
            assistant={assistant}
            t={t}
            onConnected={() => {
              setConnected((n) => n + 1);
              session.setSettingsOpen(false);
            }}
          />
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList
        entries={state.entries}
        running={running}
        t={t}
        onRestore={(entryId) => {
          void bridge.restoreTo(entryId);
        }}
      />

      {state.error !== null && (
        <div className="border-border flex-none border-t p-2">
          <Alert variant="destructive" className="py-2">
            <CircleAlert />
            <AlertDescription className="text-[11.5px] leading-4">{state.error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Обычный ход применяется сам, и решать по нему нечего — отменить его можно
          «Восстановить» на реплике. Предпросмотр остаётся ровно для случая, когда применить
          не удалось: форму правили руками, пока ассистент работал. */}
      {state.pending !== null && (
        <ChangePreview
          pending={state.pending}
          conflict={state.conflict || isStale({ host }, state.pending)}
          t={t}
          onApply={() => {
            void bridge.applyPending(false);
          }}
          onForceApply={() => {
            void bridge.applyPending(true);
          }}
          onReject={() => {
            bridge.rejectPending();
          }}
        />
      )}

      <div className="border-border flex-none border-t p-2">
        <div className="flex items-end gap-1.5">
          <Textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={t('chat.placeholder')}
            disabled={running}
            className="min-h-[38px] flex-1 resize-none px-2 py-1.5 text-[12.5px] md:text-[12.5px]"
          />
          {running ? (
            <Button
              variant="outline"
              size="icon-sm"
              title={t('chat.stop')}
              onClick={() => {
                bridge.abort();
              }}
            >
              <Square />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              title={t('chat.send')}
              onClick={submit}
              disabled={draft.trim() === ''}
            >
              <Send />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
