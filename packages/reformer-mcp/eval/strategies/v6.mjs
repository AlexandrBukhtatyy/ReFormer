/**
 * Стратегия извлечения знания на ТЕКУЩЕЙ поверхности (v6): find_recipe → search_docs →
 * (при необходимости) resources/read.
 *
 * Что моделируем и почему именно так. Агент, которому нужно решить задачу, не знает
 * канонического топика — он пишет своими словами. Порядок вызовов взят из самодокументации
 * сервера (`docs/llms/02-tools.md`: «когда знаешь сценарий — find_recipe, когда нет —
 * search_docs») и из промпта `start-here`. Стратегия останавливается, как только нужное
 * имя API найдено: именно так ведёт себя агент, и именно это делает метрику «сколько
 * вызовов/токенов до знания» осмысленной.
 *
 * Важное ограничение, которое надо держать в голове при чтении цифр: это eval ИЗВЛЕЧЕНИЯ,
 * а не генерации. Он отвечает на вопрос «отдал ли сервер нужное знание, за сколько вызовов
 * и токенов», а не «написала ли модель правильный код». Это сознательный выбор: только
 * первое сервер контролирует, только оно детерминировано и годится в CI-гейт.
 */

import { matched } from '../lib/match.mjs';

export const name = 'v6';
export const description = 'find_recipe → search_docs → resources/read (текущая поверхность)';

/** Инструменты, которые стратегия реально зовёт. Runner считает по ним поверхность набора. */
export const tools = ['find_recipe', 'search_docs'];

/**
 * @param {import('../lib/client.mjs').McpClient} client
 * @param {object} task — запись корпуса
 * @returns {Promise<{hit:boolean, firstPass:boolean, calls:number, chars:number, ms:number,
 *                    trace:Array<{tool:string,arg:string,chars:number,hit:boolean}>}>}
 */
export async function run(client, task) {
  const trace = [];
  let calls = 0;
  let chars = 0;
  let ms = 0;
  let hit = false;
  let firstPass = false;

  for (let qi = 0; qi < task.queries.length; qi++) {
    const query = task.queries[qi];

    // 1. Курируемый рецепт по топику.
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

    // 2. Полнотекстовый поиск — выдаёт сниппеты + URI.
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

    // 3. Сниппетов не хватило — читаем верхнюю секцию целиком.
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
