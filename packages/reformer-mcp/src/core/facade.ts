/**
 * Каскад извлечения одним вызовом — для консумента, у которого нет места под набор инструментов.
 *
 * Зачем. Поверхность инструментов уходит в запрос модели на КАЖДОМ шаге хода, и у визуального
 * билдера бюджет на все инструменты равен 7700 символов, уже занятый редактором. Полный набор
 * сервера — 8854. Не влезает ни один осмысленный поднабор.
 *
 * Замер (`docs/mcp-eval/builder-toolset.md`, 49 задач, равные условия):
 *
 *   choose_api + get_context               2188 симв.  hit 91.8%  first-pass 73.5%  40 329 tok
 *   choose_api + find_recipe + search_docs 2858 симв.  hit  100%  first-pass 93.9%  34 620 tok
 *   этот фасад                             ~350 симв.  hit 95.9%  first-pass 85.7%  28 930 tok
 *
 * Это РАЗМЕН, а не превосходство, и называть его надо честно: фасад отстаёт от набора на
 * 8 п.п. first-pass и 4 п.п. hit, выигрывая 16% токенов и 87% поверхности. Оправдан он тем,
 * что набор в бюджет консумента не влезает вообще — выбор идёт не между «фасад и набор», а
 * между «фасад и ничего».
 *
 * Причина отставания понятна и, вероятно, неустранима до конца: набор позволяет модели вести
 * поиск — увидеть ответ, переформулировать, уточнить. Фасад отвечает один раз на то, что
 * спросили. Композитная выдача (решение + ссылки на секции разом) отыграла 2 п.п. из этого
 * разрыва, но не весь.
 *
 * Что фасад даёт взамен, кроме места:
 *
 *  - **промахи не оплачиваются контекстом.** В наборе каждый неудачный шаг ложится в контекст
 *    и остаётся там до конца хода; здесь наружу уходит только собранный ответ;
 *  - **один вызов на задачу в типичном случае** (медиана 1, p95 4). Ход агента ограничен числом
 *    шагов, и каскад из четырёх обращений съедал их у правок формы.
 *
 * Порядок шагов повторяет baseline-стратегию `v6-choose`: решение по API первым (оно дешевле и
 * точнее любого поиска, когда правило срабатывает), затем курируемый рецепт, затем полнотекст.
 *
 * @module reformer-mcp/core/facade
 */

import { assemble } from './context/budget.js';
import type { Knowledge } from './knowledge.js';
import { chooseApiTool } from './tools/choose-api.js';
import { isEmptyAnswer } from './tools/empty-answer.js';
import { findRecipeTool } from './tools/find-recipe.js';
import { searchDocsTool } from './tools/search-docs.js';

/** Один шаг каскада — для отладки и телеметрии консумента. */
export interface FacadeStep {
  tool: string;
  chars: number;
  /** Дал ли шаг содержательный ответ. */
  hit: boolean;
}

export interface FacadeAnswer {
  /** Текст для модели, уже уложенный в бюджет. */
  text: string;
  /** Нашлось ли хоть что-то. */
  found: boolean;
  /** Пройденные шаги. Наружу не уходят — только результат. */
  trace: FacadeStep[];
  /** Был ли ответ урезан по бюджету. */
  truncated: boolean;
}

export interface AskOptions {
  /** Целевой пакет/стек (`core`, `renderer-json`, …) — сужает поиск. */
  target?: string;
  /**
   * Потолок ответа в символах. У консумента он свой и жёсткий: билдер режет ответ инструмента
   * до `TOOL_TEXT_BUDGET`, и обрезка на его стороне будет тупой — по символам, посреди
   * блока кода. Лучше уложиться здесь, где известно, что резать.
   */
  maxChars?: number;
}

const textOf = (r: { content: Array<{ type: 'text'; text: string }> }) =>
  r.content.map((c) => c.text).join('\n');

/**
 * Ответить на вопрос о ReFormer одним обращением.
 *
 * Каскад останавливается на первом содержательном ответе — ровно так же, как остановился бы
 * агент, если бы звал инструменты сам.
 */
export async function askReformer(
  k: Knowledge,
  question: string,
  options: AskOptions = {}
): Promise<FacadeAnswer> {
  const q = String(question ?? '').trim();
  const trace: FacadeStep[] = [];

  if (!q) {
    return {
      text: 'Задайте вопрос словами: что нужно сделать в форме или какой API за это отвечает.',
      found: false,
      trace,
      truncated: false,
    };
  }

  const step = (tool: string, text: string): boolean => {
    const hit = text.trim().length > 0 && !isEmptyAnswer(text);
    trace.push({ tool, chars: text.length, hit });
    return hit;
  };

  // Ответ СОБИРАЕТСЯ из шагов, а не берётся с первого удачного.
  //
  // Замер показал, почему «первый непустой» недостаточен. Набор инструментов позволяет модели
  // комбинировать: `choose_api` даёт направление, `search_docs` — где про это написано, и вместе
  // они попадают в цель чаще, чем любой поодиночке. Фасад, останавливающийся на первом ответе,
  // это преимущество терял: hit 93.9% против 100% у набора.
  //
  // Приоритеты не декоративны. Решение по API — самое точное, что может дать сервер, когда
  // правило сработало; ссылки на секции ценны всегда, но проигрывают решению, если места мало.
  // `assemble` уронит их первыми — и это правильный порядок потери.
  const chunks: Array<{ priority: number; text: string; truncatable?: boolean }> = [];

  const decision = textOf(await chooseApiTool({ requirement: q, target: options.target }, k));
  if (step('choose_api', decision)) chunks.push({ priority: 0, text: decision, truncatable: true });

  // Курируемый рецепт — только если решения не нашлось: рецепт длинный, и вместе с решением он
  // вытеснил бы из бюджета всё остальное, не добавив точности.
  if (chunks.length === 0) {
    const recipe = textOf(await findRecipeTool({ topic: q }, k));
    if (step('find_recipe', recipe)) chunks.push({ priority: 0, text: recipe, truncatable: true });
  }

  // Полнотекстовый поиск идёт ВСЕГДА: даже при сработавшем правиле он добавляет адреса секций,
  // куда агент пойдёт за подробностями. Это дёшево — выдача ранжирована и коротка.
  const search = textOf(await searchDocsTool({ query: q, limit: 5 }, k));
  if (step('search_docs', search)) chunks.push({ priority: 1, text: search, truncatable: true });

  if (chunks.length > 0) return budgeted(chunks, options, trace);

  return {
    text:
      `По запросу «${q}» ничего не нашлось. Переформулируйте одним конкретным поведением ` +
      `(«значение выводится из…», «поле выключается, когда…») или назовите имя API.`,
    found: false,
    trace,
    truncated: false,
  };
}

/**
 * Уложить ответ в бюджет.
 *
 * Через `assemble`, а не срезом по длине: он режет по строкам и добивает незакрытый код-фенс,
 * а обрыв посреди примера модель дописывает сама — и получает несуществующий API. Замер это
 * подтвердил: единственная потерянная из 49 задач потерялась ровно на тупой обрезке рецепта
 * длиной 9897 символов.
 */
function budgeted(
  chunks: Array<{ priority: number; text: string; truncatable?: boolean }>,
  options: AskOptions,
  trace: FacadeStep[]
): FacadeAnswer {
  const maxChars = options.maxChars;
  const joined = assemble(chunks, null).text;
  if (!maxChars || joined.length <= maxChars) {
    return { text: joined, found: true, trace, truncated: false };
  }

  // `assemble` считает в токенах (символы/4) и дописывает пометку об обрезке и закрывающий
  // код-фенс УЖЕ ПОСЛЕ подсчёта — результат может выйти за лимит на длину этого хвоста
  // (замерено: 1538 при запрошенных 1500). Для консумента потолок жёсткий: превышение он
  // дорежет сам, по символам, и всё, ради чего здесь резали по строкам, пропадёт.
  //
  // Поэтому бюджет ужимается на фактическое превышение, а не на угаданный запас: длина хвоста
  // зависит от того, сколько именно не влезло, и константа рассохлась бы при первой правке
  // формулировки.
  let budget = Math.floor(maxChars / 4);
  let out = assemble(chunks, budget);
  for (let attempt = 0; out.text.length > maxChars && attempt < 3; attempt++) {
    budget -= Math.ceil((out.text.length - maxChars) / 4) + 1;
    if (budget <= 0) break;
    out = assemble(chunks, budget);
  }

  // Последняя страховка: контракт «не длиннее maxChars» обязан соблюдаться даже если сборка
  // повела себя неожиданно. Срез по символам здесь — не рабочий путь, а признак того, что
  // выше что-то изменилось.
  const capped = out.text.length > maxChars ? out.text.slice(0, maxChars) : out.text;
  return { text: capped, found: true, trace, truncated: out.truncated || capped !== out.text };
}
