/**
 * Реплика как последовательность блоков ленты — в том порядке, в каком ход их произвёл.
 *
 * Текст реплики хранится одной строкой, вызовы и вопросы — своими списками; где между ними
 * граница, говорят метки сессии (`EntryMark`). Здесь текст нарезается по меткам: пояснение перед
 * вызовом встаёт над его строкой, а итог хода — под журналом правок, к которым он относится.
 *
 * @module plugins/forms/ai/ui/timeline
 */

import type { AskCard, ChatEntry, EntryMark, ToolLogEntry } from '../session/session';

/** Блок ленты внутри реплики. */
export type EntryBlock =
  | { readonly kind: 'text'; readonly text: string }
  /** Подряд идущие вызовы — одним списком: между ними модель ничего не писала. */
  | { readonly kind: 'tools'; readonly tools: readonly ToolLogEntry[] }
  | { readonly kind: 'ask'; readonly card: AskCard };

/**
 * Метки реплики, у которой их нет, — порядок, каким лента рисовала её до меток: вопросы над
 * текстом, журнал под ним. Так выглядит реплика пользователя и реплика, собранная в обход сессии.
 */
function legacyMarks(entry: ChatEntry): readonly EntryMark[] {
  return [
    ...(entry.asks ?? []).map((card) => ({ kind: 'ask' as const, at: 0, id: card.id })),
    ...entry.tools.map((_, index) => ({
      kind: 'tool' as const,
      at: entry.text.length,
      index,
    })),
  ];
}

/**
 * Разложить реплику на блоки в порядке хода.
 *
 * Куски текста обрезаются по краям: перед блоком, начатым после вызова, сессия ставит пустую
 * строку-разделитель, и в отдельном блоке она была бы дырой над текстом.
 */
export function timelineOf(entry: ChatEntry): readonly EntryBlock[] {
  const blocks: EntryBlock[] = [];
  let from = 0;

  const flushText = (to: number): void => {
    const end = Math.min(Math.max(to, from), entry.text.length);
    const piece = entry.text.slice(from, end).trim();
    if (piece !== '') blocks.push({ kind: 'text', text: piece });
    from = end;
  };

  for (const mark of entry.marks ?? legacyMarks(entry)) {
    flushText(mark.at);
    if (mark.kind === 'tool') {
      const tool = entry.tools.at(mark.index);
      if (tool === undefined) continue;
      const previous = blocks.at(-1);
      if (previous?.kind === 'tools') {
        blocks[blocks.length - 1] = { kind: 'tools', tools: [...previous.tools, tool] };
      } else {
        blocks.push({ kind: 'tools', tools: [tool] });
      }
    } else {
      const card = entry.asks?.find((known) => known.id === mark.id);
      if (card !== undefined) blocks.push({ kind: 'ask', card });
    }
  }
  flushText(entry.text.length);
  return blocks;
}
