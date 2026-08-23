/**
 * Стратегия «поверхность билдера»: `choose_api` → `get_context`, и больше ничего.
 *
 * Зачем отдельный замер. У консумента с ограниченным бюджетом инструментов — визуального
 * билдера (`projects/reformer-builder`, храповик `TOOL_SURFACE_BUDGET = 7700` символов на ВСЕ
 * инструменты, уже занятый тринадцатью инструментами редактора) — нельзя завести всю поверхность
 * сервера: она одна стоит 8854 символа. Значит вопрос не «сколько даёт сервер», а «сколько даёт
 * САМЫЙ ДЕШЁВЫЙ набор, который туда влезает». Три кандидата уже покрыты существующими
 * стратегиями, четвёртый — этот:
 *
 *   `get_context` один                        → v7      (856 симв.)
 *   `choose_api` + `get_context`              → ЗДЕСЬ   (2185 симв.)
 *   `choose_api` + `find_recipe` + `search_docs` → v6-choose (2854 симв., = baseline)
 *   без decision-слоя                          → v6      (1525 симв.)
 *
 * Обратите внимание на порядок цен: набор из ДВУХ инструментов дешевле набора из трёх на 669
 * символов. Если он даёт сопоставимый first-pass, он и есть ответ — а если нет, разница в
 * процентах прямо конвертируется в цену, которую билдер платит за каждый шаг каждого хода.
 *
 * Почему тут нет `validate_form`. Он не участвует в извлечении знания: он проверяет уже
 * написанный код и на first-pass влиять не может по построению. Его цена (1326 символов)
 * добавляется к ЛЮБОМУ набору одинаково, поэтому в сравнении наборов он лишний — иначе все
 * четыре строки сдвинулись бы на одну и ту же константу, а решение не изменилось бы.
 *
 * Почему нет запасного пути в `search_docs` (в отличие от v7). v7 меряет обещание контекстного
 * слоя и оставляет запасной путь, чтобы отличить «контекст не дал» от «знания нет вообще».
 * Здесь измеряется НАБОР: если инструмента не будет в билдере, агент не сможет его позвать, и
 * учитывать его вклад — значит завысить метрику ровно на то, чего у консумента не будет.
 */

import { matched } from '../lib/match.mjs';

export const name = 'builder';
export const description = 'choose_api → get_context (поверхность, влезающая в бюджет билдера)';

/** Инструменты, которые стратегия реально зовёт. Runner считает по ним поверхность набора. */
export const tools = ['choose_api', 'get_context'];

export async function run(client, task) {
  const trace = [];
  let calls = 0;
  let chars = 0;
  let ms = 0;

  // 1. Решение по требованию — тот же первый шаг, что в v6-choose. Дёшево и детерминированно.
  const decision = await client.callTool('choose_api', {
    requirement: task.task,
    target: task.target,
  });
  calls++;
  chars += decision.chars;
  ms += decision.ms;
  const decisionHits = matched(decision.text, task.expectAny);
  trace.push({
    tool: 'choose_api',
    arg: task.task,
    chars: decision.chars,
    hit: decisionHits.length > 0,
  });
  if (decisionHits.length > 0) {
    return { hit: true, firstPass: true, calls, chars, ms, trace };
  }

  // 2. Контекст под ту же формулировку. Это всё ещё ПЕРВЫЙ заход: агент не переформулировал
  //    задачу, он взял второй инструмент из тех двух, что у него есть.
  const first = await client.callTool('get_context', {
    task: task.task,
    target: task.target,
    profile: 'implementation',
  });
  calls++;
  chars += first.chars;
  ms += first.ms;
  const firstHits = matched(first.text, task.expectAny);
  trace.push({
    tool: 'get_context',
    arg: task.task,
    chars: first.chars,
    hit: firstHits.length > 0,
  });
  if (firstHits.length > 0) {
    return { hit: true, firstPass: true, calls, chars, ms, trace };
  }

  // 3. Переформулировки. Первая (`queries[0]`) в корпусе — самая естественная и обычно совпадает
  //    с `task`; повторять её вторым вызовом того же инструмента бессмысленно, поэтому шаг
  //    пропускается, а не тратит вызов.
  let hit = false;
  for (const query of task.queries) {
    if (query === task.task) continue;

    const ctx = await client.callTool('get_context', {
      task: query,
      target: task.target,
      profile: 'implementation',
    });
    calls++;
    chars += ctx.chars;
    ms += ctx.ms;
    const hits = matched(ctx.text, task.expectAny);
    trace.push({ tool: 'get_context', arg: query, chars: ctx.chars, hit: hits.length > 0 });
    if (hits.length > 0) {
      hit = true;
      break;
    }
  }

  return { hit, firstPass: false, calls, chars, ms, trace };
}
