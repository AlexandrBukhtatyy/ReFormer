/**
 * Пометка формы, над которой идёт ход, — на её вкладке и в строке дерева.
 *
 * Ход работает с формой в фоне: человек остаётся на своей вкладке (файл правил, другая форма,
 * README), а форма хода открывается рядом, не отнимая фокуса. Без пометки не видно, над какой из
 * открытых вкладок работает ассистент, — она и говорит это, пока ход идёт.
 *
 * Форма хода — та, что в снимке последней реплики человека: её ставит начало хода, а продолжение на
 * созданной или выбранной форме переставляет (`AiSession.retarget`). Сигнал «пометка изменилась»
 * уходит только при смене этой формы, а не на каждый кусок ответа: сессия меняется на каждом.
 *
 * @module plugins/forms/ai/ui/turn-form-decoration
 */

import type { ReactElement } from 'react';
import { Sparkles } from 'lucide-react';
import type { ResourceDecorationContribution, ResourceId } from '@reformer/builder-plugin-api';
import type { AiSession, AiSessionState } from '../session/session';

/** Идентификатор вклада пометки. */
export const TURN_FORM_DECORATION_ID = 'ai.turn-form';

/** Форма идущего хода или `null`: хода нет, или формы у него ещё нет (выбор, создание). */
export function turnFormOf(state: AiSessionState): ResourceId | null {
  if (state.status !== 'running') return null;
  for (let i = state.entries.length - 1; i >= 0; i--) {
    const entry = state.entries[i];
    if (entry.role !== 'user') continue;
    return entry.snapshot?.resource ?? null;
  }
  return null;
}

function TurnFormIcon(): ReactElement {
  return <Sparkles aria-hidden="true" className="text-primary size-3.5 animate-pulse" />;
}

/** Вклад точки `ResourceDecorationPoint`: форма идущего хода. */
export function turnFormDecoration(session: AiSession): ResourceDecorationContribution {
  return {
    id: TURN_FORM_DECORATION_ID,
    decorate: (ref) =>
      ref.id === turnFormOf(session.get())
        ? { icon: TurnFormIcon, tone: 'accent', tooltipKey: 'decoration.turnForm' }
        : null,
    onDidChange(cb) {
      let shown = turnFormOf(session.get());
      return session.subscribe(() => {
        const next = turnFormOf(session.get());
        if (next === shown) return;
        shown = next;
        cb();
      });
    },
  };
}
