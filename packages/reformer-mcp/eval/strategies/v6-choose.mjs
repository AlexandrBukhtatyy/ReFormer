/**
 * Стратегия с decision-слоем: `choose_api` → далее как в v6.
 *
 * Смысл замера. Стратегия `v6` показала устойчивую картину: девять задач не берутся с первой
 * формулировки, и в каждой срабатывает лишь последний запрос, буквально равный имени символа.
 * То есть агенту не хватало РЕШЕНИЯ («какой из двух похожих операторов»), а не текста.
 * `choose_api` отвечает именно на это, поэтому здесь он стоит первым — а всё остальное
 * (find_recipe → search_docs → resources/read) осталось нетронутым, чтобы разница
 * приписывалась одному изменению, а не смеси.
 *
 * Формулировка задачи (`task`) идёт в `choose_api`, а не первый `queries[0]`: правила
 * читают требование целиком, на том языке, на котором его ставит человек.
 */

import { matched } from '../lib/match.mjs';

export const name = 'v6-choose';
export const description = 'choose_api → find_recipe → search_docs → resources/read';

export async function run(client, task) {
  const trace = [];
  let calls = 0;
  let chars = 0;
  let ms = 0;
  let hit = false;
  let firstPass = false;

  // 1. Решение по требованию. Дёшево и детерминированно.
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

  // 2. Дальше — ровно путь v6.
  for (let qi = 0; qi < task.queries.length; qi++) {
    const query = task.queries[qi];

    const recipe = await client.callTool('find_recipe', { topic: query });
    calls++;
    chars += recipe.chars;
    ms += recipe.ms;
    const recipeHits = matched(recipe.text, task.expectAny);
    trace.push({
      tool: 'find_recipe',
      arg: query,
      chars: recipe.chars,
      hit: recipeHits.length > 0,
    });
    if (recipeHits.length > 0) {
      hit = true;
      if (qi === 0) firstPass = true;
      break;
    }

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
      if (qi === 0) firstPass = true;
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
        if (qi === 0) firstPass = true;
        break;
      }
    }
  }

  return { hit, firstPass, calls, chars, ms, trace };
}
