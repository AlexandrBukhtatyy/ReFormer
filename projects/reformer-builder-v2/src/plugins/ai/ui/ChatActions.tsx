/**
 * Действия ассистента в шапке дока: отменить ход, начать разговор заново, настройки канала.
 *
 * ## Почему они уехали из тела панели
 *
 * Раньше это была своя полоса кнопок первой строкой содержимого, под заголовком дока. Она
 * стоила ленте разговора высоту строки на каждом кадре и повторяла шапку, которая уже
 * нарисована и пуста справа: заголовок «Ассистент» и ряд действий над ним — один и тот же
 * ярус интерфейса, разложенный на два.
 *
 * ## Состояние берётся из ТОЙ ЖЕ сессии, что и лента
 *
 * Шапка и тело — разные поддеревья, и общего родителя у них нет. Но сессия — объект
 * с подпиской, а не состояние компонента, поэтому обе стороны читают один снимок: кнопка
 * «настройки» знает, что экран настроек открыт, а «новый разговор» — что ход идёт, без
 * единого канала между поддеревьями.
 *
 * @module plugins/ai/ui/ChatActions
 */

import { useState, type ReactElement } from 'react';
import { MessageSquarePlus, Settings2, Undo2 } from 'lucide-react';
import { Button } from '@reformer/ui-kit/button';
import type { AgentBridge } from '../bridge';
import type { AiHost } from '../host';
import type { AiSession } from '../session';
import { useAiSession } from './useSession';

export interface ChatActionsProps {
  readonly host: AiHost;
  readonly session: AiSession;
  readonly bridge: AgentBridge;
}

export function ChatActions({ host, session, bridge }: ChatActionsProps): ReactElement {
  const t = host.useTranslate();
  const state = useAiSession(session);
  // Отмена хода состояния сессии не меняет (лента остаётся какой была — в том и смысл),
  // поэтому перерисовку после неё ряд запрашивает сам: иначе кнопка осталась бы доступной
  // на вид до ближайшего чужого изменения.
  const [, force] = useState(0);
  const running = state.status === 'running';

  return (
    <>
      {/* Через мост, а не прямым вызовом: у отмены один вход, и охранное условие с записью
          в палитре относятся к нему же. Доступность спрашивается у моста напрямую — это
          чтение, а не действие, и оно обязано быть дешёвым. */}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('chat.undoTurn')}
        title={t('chat.undoTurn')}
        data-testid="chat-undo-turn"
        disabled={!bridge.canUndoTurn()}
        onClick={() => {
          void bridge.requestUndoTurn().then(() => force((tick) => tick + 1));
        }}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('chat.newConversation')}
        title={t('chat.newConversation')}
        data-testid="chat-new-conversation"
        disabled={running}
        onClick={() => {
          session.reset();
        }}
      >
        <MessageSquarePlus />
      </Button>
      <Button
        variant={state.settingsOpen ? 'secondary' : 'ghost'}
        size="icon-sm"
        aria-label={t('chat.settings')}
        title={t('chat.settings')}
        data-testid="chat-settings"
        aria-pressed={state.settingsOpen}
        onClick={() => {
          session.setSettingsOpen(!state.settingsOpen);
        }}
      >
        <Settings2 />
      </Button>
    </>
  );
}
