/**
 * Стратегия «один вызов»: `get_context` и всё.
 *
 * Проверяет обещание контекстного слоя буквально: хватает ли ОДНОГО обращения, чтобы агент
 * получил нужное знание. Запасной путь (`find_recipe` → `search_docs` → `resources/read`)
 * оставлен, но считается отдельно — по числу задач, где он понадобился, видно, где
 * контекстный слой недотягивает.
 *
 * Формулировка идёт в `get_context` целиком, на языке задачи: сборщик сам решает, читается
 * ли она как требование (тогда сработает decision-слой) или как тема для поиска.
 */

import { matched } from '../lib/match.mjs';

export const name = 'v7';
export const description = 'get_context одним вызовом, с запасным путём v6';

export async function run(client, task) {
  const trace = [];
  let calls = 0;
  let chars = 0;
  let ms = 0;

  const ctx = await client.callTool('get_context', {
    task: task.task,
    target: task.target,
    profile: 'implementation',
  });
  calls++;
  chars += ctx.chars;
  ms += ctx.ms;
  const ctxHits = matched(ctx.text, task.expectAny);
  trace.push({ tool: 'get_context', arg: task.task, chars: ctx.chars, hit: ctxHits.length > 0 });
  if (ctxHits.length > 0) {
    return { hit: true, firstPass: true, calls, chars, ms, trace };
  }

  // Запасной путь — тот же, что в v6. Нужен, чтобы отличить «контекст не дал» от
  // «знания нет вообще»: без него обе ситуации выглядели бы одинаково.
  let hit = false;
  for (const query of task.queries) {
    const search = await client.callTool('search_docs', { query, limit: 5 });
    calls++;
    chars += search.chars;
    ms += search.ms;
    const searchHits = matched(search.text, task.expectAny);
    trace.push({
      tool: 'search_docs',
      arg: query,
      chars: search.chars,
      hit: searchHits.length > 0,
    });
    if (searchHits.length > 0) {
      hit = true;
      break;
    }

    const uri = (search.text.match(/reformer:\/\/docs\/[^\s`]+/) ?? [])[0];
    if (uri) {
      const section = await client.readResource(uri);
      calls++;
      chars += section.chars;
      ms += section.ms;
      const sectionHits = matched(section.text, task.expectAny);
      trace.push({
        tool: 'resources/read',
        arg: uri,
        chars: section.chars,
        hit: sectionHits.length > 0,
      });
      if (sectionHits.length > 0) {
        hit = true;
        break;
      }
    }
  }

  return { hit, firstPass: false, calls, chars, ms, trace };
}
