/**
 * История диалога для модели: что из ленты уходит в контекст и сколько его.
 *
 * ## Здесь живут два урока живых прогонов v1 — их нельзя потерять
 *
 * Оба физически лежали в `agent/run.ts` v1, то есть в мосте, и уехали бы вместе с ним. Вынесены
 * сюда отдельным модулем ровно поэтому: в мосте они были парой приватных функций, которые
 * ничем не проверялись, а здесь у них есть имя и тест.
 *
 * **Урок 7 — молчаливый ход не пустой** ({@link assistantContent}). Ход, в котором модель не
 * сказала ни слова, а только звала инструменты, изменил форму. Такие ходы бывают у моделей,
 * которые в tool-режиме молчат до последнего шага и обрываются на пределе, так и не дойдя до
 * текста. Отдай его в историю как пустоту — и следующий ход не знает, что уже сделано, и
 * начинает форму заново.
 *
 * **Урок 8 — бюджет в СИМВОЛАХ, а не в числе реплик** ({@link HISTORY_BUDGET}). Длина реплики
 * не ограничена ничем: десять реплик — это и пара килобайт, и пара десятков. Считать надо то,
 * за что платят, а платят за объём.
 *
 * ## Сводка сделанного — по-английски
 *
 * Единственное сознательное отступление от v1, где она была на русском. Текст уходит МОДЕЛИ,
 * а не человеку, а всё, что уходит модели, в v2 не локализуется (см. `./messages`): язык
 * контекста не должен зависеть от языка интерфейса. Русская строка здесь была бы той же
 * ошибкой, что и переведённое описание инструмента, — просто менее заметной.
 *
 * @module plugins/forms/ai/session/history
 */

import type { AiMessage } from '../providers/types';
import { answerText } from '../tools/ask-user';
import { snapshotPath, type ChatEntry } from './session';

/**
 * Сколько символов истории уходит в модель.
 *
 * Урок 8. Бюджет в символах, а не счёт реплик — см. шапку модуля.
 */
export const HISTORY_BUDGET = 6000;

/**
 * Сколько вызовов инструментов перечислять в сводке молчаливого хода.
 *
 * Сводка нужна как напоминание «что уже сделано», а не как полный журнал: он и так виден
 * в панели, и повторять его целиком значило бы платить за него на каждом следующем шаге.
 */
const TOOLS_IN_SUMMARY = 12;

/**
 * Реплика ассистента в том виде, в каком её видит модель.
 *
 * Урок 7: ход без единого слова — это не пустая реплика, а список сделанного.
 *
 * Вопросы модели и ответы человека (`ask_user`) идут сюда же, строкой на вопрос: ответ
 * пришёл результатом вызова внутри хода, а в историю следующих ходов вызовы не попадают — без
 * этих строк модель забыла бы, что ей уже ответили, и спросила бы снова.
 *
 * @param entry - Реплика ассистента из ленты.
 */
export function assistantContent(entry: Pick<ChatEntry, 'text' | 'tools' | 'asks'>): string {
  const asked = (entry.asks ?? []).flatMap((card) =>
    card.questions.map((question, index) => {
      const answer = card.answers?.[index];
      const result = answer ? `answer: ${answerText(answer)}` : 'no answer, turn stopped';
      return `(asked the user: "${question.question}" — ${result})`;
    })
  );
  if (entry.text.trim().length > 0) return [entry.text, ...asked].join('\n');
  if (entry.tools.length === 0 && asked.length > 0) return asked.join('\n');
  const done = entry.tools
    .slice(0, TOOLS_IN_SUMMARY)
    .map((tool) => tool.summary ?? tool.name)
    .join('; ');
  const rest = entry.tools.length - Math.min(entry.tools.length, TOOLS_IN_SUMMARY);
  return [`(no comment; done: ${done}${rest > 0 ? ` and ${rest} more` : ''})`, ...asked].join('\n');
}

/**
 * Реплика пользователя в том виде, в каком её видит модель: текст, ссылки на прикреплённое (если
 * было) и форма хода (`form`) — когда её надо назвать, решает {@link historyFor}.
 *
 * Только ссылки, без содержимого: содержимое уходит модели в своём ходе (`./resources`), а в
 * истории — адрес, по которому его можно перечитать `read_resource`. Иначе один прикреплённый
 * файл вытеснял бы из бюджета истории весь разговор.
 */
export function userContent(entry: Pick<ChatEntry, 'text' | 'attachments'>, form?: string): string {
  const attached = entry.attachments ?? [];
  const lines = [entry.text];
  if (attached.length > 0) {
    lines.push(`(attached: ${attached.map((ref) => `${ref.name} <${ref.uri}>`).join(', ')})`);
  }
  if (form !== undefined) lines.push(`(form: ${form})`);
  return lines.join('\n');
}

/**
 * История диалога для модели — из уже показанных реплик, чтобы контекст совпадал с видимым.
 *
 * Набирается С КОНЦА: свежие реплики нужнее старых, а обрезать надо по началу диалога.
 * Последняя проходит всегда — это сообщение, на которое агент и отвечает; иначе бюджет,
 * заданный меньше одной реплики, оставил бы модель вообще без вопроса.
 *
 * Реплика пользователя помечает форму (`(form: путь)`), если её ход шёл по другой форме, чем
 * предыдущий, — и самая первая. История общая на все формы, и без пометки модель не отличит
 * разговор о форме A от разговора о форме B. Пометка зависит только от реплик ДО неё, поэтому
 * текст прошлых реплик от хода к ходу не меняется и префикс запроса остаётся кэшируемым.
 *
 * @param entries - Лента диалога.
 * @param budget - Потолок в символах; по умолчанию {@link HISTORY_BUDGET}.
 */
export function historyFor(
  entries: readonly ChatEntry[],
  budget: number = HISTORY_BUDGET
): AiMessage[] {
  let previousForm: string | undefined;
  const all: AiMessage[] = entries
    .filter(
      (entry) =>
        entry.text.trim().length > 0 || entry.tools.length > 0 || (entry.asks?.length ?? 0) > 0
    )
    .map((entry) => {
      if (entry.role === 'assistant') return { role: entry.role, content: assistantContent(entry) };
      const form = snapshotPath(entry);
      const changed = form !== undefined && form !== previousForm;
      if (form !== undefined) previousForm = form;
      return { role: entry.role, content: userContent(entry, changed ? form : undefined) };
    });

  const kept: AiMessage[] = [];
  let spent = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    spent += all[i].content.length;
    if (spent > budget && kept.length > 0) break;
    kept.unshift(all[i]);
  }
  return kept;
}
