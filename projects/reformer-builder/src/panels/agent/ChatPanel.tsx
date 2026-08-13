/**
 * Панель ассистента — содержимое правой зоны оболочки наравне с инспектором.
 *
 * Инспектор и ассистент делят одну зону и переключаются рейлом: обоим нужна ширина, а держать их
 * рядом означало бы отдать под правый борт половину экрана. Заголовок панели и кнопки действий
 * рисует оболочка (`RIGHT_PANELS`), поэтому здесь только рабочая область.
 *
 * @module reformer-builder/panels/agent/ChatPanel
 */

import { useEffect, useState, type KeyboardEvent } from 'react';
import { CircleAlert, Send, Square } from 'lucide-react';
import { Button } from '@reformer/ui-kit';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Textarea } from '@reformer/ui-kit/textarea';
import { applyChangeSet, isStale } from '../../agent/apply';
import { abortTurn, sendMessage } from '../../agent/run';
import { firstEditingProvider } from '../../agent/providers/registry';
import { restoreProvider } from '../../agent/providers/load';
import { agentSessionActions, useAgentSession } from '../../agent/session';
import { ChangePreview } from './ChangePreview';
import { MessageList } from './MessageList';
import { ProviderSettings } from './ProviderSettings';

/** Рабочая область ассистента. */
export function ChatPanel() {
  const session = useAgentSession();
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  // Реестр каналов — обычный модульный map, а не стор: перерисовку после подключения запрашиваем сами.
  const [, bumpProvider] = useState(0);
  const refreshProvider = () => bumpProvider((n) => n + 1);

  // Канал восстанавливается при первом показе панели: SDK не должен грузиться раньше.
  useEffect(() => {
    void restoreProvider().then(refreshProvider);
  }, []);

  const provider = firstEditingProvider();
  const running = session.status === 'running';
  // Без канала показывать ленту нечего — сразу открываем настройки.
  const showSettings = session.settingsOpen || !provider;

  const submit = () => {
    const text = draft.trim();
    if (!text || running || !provider) return;
    setDraft('');
    setNotice(null);
    void sendMessage(text, provider);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Глобальные хоткеи холста не должны срабатывать при наборе текста.
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const apply = (force: boolean) => {
    if (!session.pending) return;
    const outcome = applyChangeSet(session.pending, { force });
    switch (outcome.status) {
      case 'applied':
        agentSessionActions.resolvePending();
        setNotice(null);
        break;
      case 'conflict':
        agentSessionActions.setConflict(true);
        break;
      case 'no-form':
        setNotice('Нет открытой формы: вкладку закрыли или переключили на код.');
        break;
      case 'invalid':
        setNotice(`Изменения не прошли проверку: ${outcome.errors.slice(0, 2).join('; ')}`);
        break;
      case 'empty':
        agentSessionActions.resolvePending();
        break;
    }
  };

  if (showSettings) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ProviderSettings
          onConnected={() => {
            refreshProvider();
            agentSessionActions.setSettings(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList entries={session.entries} running={running} />

      {session.error && (
        <div className="flex-none border-t border-border p-2">
          <Alert variant="destructive" className="py-2">
            <CircleAlert />
            <AlertDescription className="text-[11.5px] leading-4">{session.error}</AlertDescription>
          </Alert>
        </div>
      )}

      {notice && (
        <div className="flex-none border-t border-border p-2">
          <Alert className="py-2">
            <AlertDescription className="text-[11.5px] leading-4">{notice}</AlertDescription>
          </Alert>
        </div>
      )}

      {session.pending && (
        <ChangePreview
          set={session.pending}
          conflict={session.conflict || isStale(session.pending)}
          onApply={() => apply(false)}
          onForceApply={() => apply(true)}
          onReject={agentSessionActions.resolvePending}
        />
      )}

      <footer className="flex-none border-t border-border p-2">
        <div className="flex items-end gap-1.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Что сделать с формой?"
            disabled={running}
            className="min-h-[38px] flex-1 resize-none px-2 py-1.5 text-[12.5px] md:text-[12.5px]"
          />
          {running ? (
            <Button variant="outline" size="icon-sm" title="Остановить" onClick={abortTurn}>
              <Square />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              title="Отправить (Enter)"
              onClick={submit}
              disabled={!draft.trim()}
            >
              <Send />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
