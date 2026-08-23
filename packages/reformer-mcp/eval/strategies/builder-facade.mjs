/**
 * Стратегия «фасад»: каскад исполняется ВНУТРИ одного инструмента консумента.
 *
 * Зачем понадобилась. Замер поверхности билдера дал 7684 символа при храповике 7700 — свободно
 * шестнадцать. Значит вопрос «какой набор инструментов MCP отдать модели» поставлен неверно:
 * не влезает ни один набор, даже самый дешёвый (`get_context` — 856). А сжать поверхность
 * редактора вдвое, чтобы вместить `choose_api + find_recipe + search_docs` (2858), нельзя без
 * потери того, ради чего эти описания писались.
 *
 * Отсюда разворот: модель получает ОДИН инструмент со своим коротким описанием, а последовательность
 * `choose_api → find_recipe → search_docs` исполняется внутри него — кодом, а не моделью.
 *
 * Что это меняет в метрике, и почему замер честный:
 *
 *  - `calls` = 1 всегда. Модель делает одно обращение; внутренние шаги её контекста не касаются
 *    и шагов хода не тратят.
 *  - `chars` — длина ТОЛЬКО того ответа, который уходит модели. Промежуточные ответы каскада
 *    остаются внутри и не оплачиваются. Именно этим фасад дешевле набора: там каждый неудачный
 *    шаг ложился в контекст и оставался в нём до конца хода.
 *  - `firstPass === hit` по построению: переформулировать нечего, заход всегда один.
 *
 * Обрезка входит в модель, а не игнорируется. У консумента ответ инструмента режется до
 * `TOOL_TEXT_BUDGET = 1500` символов (`clamp` в `agent/core/registry.ts`), и фасад этого не
 * отменяет. Поэтому шаг каскада засчитывается попаданием, только если нужное имя осталось в
 * ПЕРВЫХ 1500 символах: то, что обрезано, модель не увидит, и считать это попаданием значило бы
 * мерить не фасад, а сервер. Без обрезки метрика была бы завышена ровно на длинных рецептах —
 * измерено на первом прогоне: 18 ответов из 49 (37 %) длиннее бюджета, максимум 9896 символов.
 *
 * Обрезка здесь наивная (первые N символов) намеренно: это НИЖНЯЯ граница качества. Настоящий
 * фасад будет резать по приоритету — `assemble()` из `context/budget.ts` уже умеет ронять
 * «см. также» раньше сигнатуры, — и может только улучшить результат относительно этого замера.
 *
 * Поверхность самого фасада здесь не считается (`export const tools` отсутствует намеренно):
 * его описание живёт в билдере, а не в `tools/list` сервера, и сравнивать его надо с бюджетом
 * билдера, а не со статикой MCP.
 */

import { matched } from '../lib/match.mjs';

/** Бюджет ответа инструмента у консумента: projects/reformer-builder/src/agent/core/types.ts. */
const TOOL_TEXT_BUDGET = 1500;

export const name = 'builder-facade';
export const description = 'один вызов консумента; choose_api → find_recipe → search_docs внутри';

export async function run(client, task) {
  const trace = [];
  let ms = 0;
  // Внутренние вызовы считаются отдельно от того, что уходит модели: первое — цена для сервера,
  // второе — цена для контекста. Смешивать их значило бы приписать модели чужой расход.
  let innerCalls = 0;

  const step = async (tool, args, arg) => {
    const r = await client.callTool(tool, args);
    innerCalls++;
    ms += r.ms;
    const visible = r.text.slice(0, TOOL_TEXT_BUDGET);
    const hits = matched(visible, task.expectAny);
    trace.push({
      tool: `inner:${tool}`,
      arg,
      chars: r.chars,
      clamped: r.chars > TOOL_TEXT_BUDGET,
      hit: hits.length > 0,
    });
    return { ...r, chars: Math.min(r.chars, TOOL_TEXT_BUDGET), ok: hits.length > 0 };
  };

  const decision = await step(
    'choose_api',
    { requirement: task.task, target: task.target },
    task.task
  );
  if (decision.ok) {
    return { hit: true, firstPass: true, calls: 1, chars: decision.chars, ms, trace, innerCalls };
  }

  for (const query of task.queries) {
    const recipe = await step('find_recipe', { topic: query }, query);
    if (recipe.ok) {
      return { hit: true, firstPass: true, calls: 1, chars: recipe.chars, ms, trace, innerCalls };
    }

    const search = await step('search_docs', { query, limit: 5 }, query);
    if (search.ok) {
      return { hit: true, firstPass: true, calls: 1, chars: search.chars, ms, trace, innerCalls };
    }

    const uri = (search.text.match(/reformer:\/\/docs\/[^\s`]+/) ?? [])[0];
    if (uri) {
      const section = await client.readResource(uri);
      innerCalls++;
      ms += section.ms;
      const visible = section.text.slice(0, TOOL_TEXT_BUDGET);
      const hits = matched(visible, task.expectAny);
      trace.push({
        tool: 'inner:resources/read',
        arg: uri,
        chars: section.chars,
        clamped: section.chars > TOOL_TEXT_BUDGET,
        hit: hits.length > 0,
      });
      if (hits.length > 0) {
        const chars = Math.min(section.chars, TOOL_TEXT_BUDGET);
        return { hit: true, firstPass: true, calls: 1, chars, ms, trace, innerCalls };
      }
    }
  }

  // Каскад исчерпан. Модель всё равно получит ровно один ответ — «не нашлось», и он короткий.
  return { hit: false, firstPass: false, calls: 1, chars: 120, ms, trace, innerCalls };
}
