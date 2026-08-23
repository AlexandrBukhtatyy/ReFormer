/**
 * Стратегия «фасад»: каскад исполняется ВНУТРИ одного вызова консумента.
 *
 * Зачем понадобилась. Замер поверхности билдера дал 7684 символа при храповике 7700 — свободно
 * шестнадцать. Значит вопрос «какой набор инструментов MCP отдать модели» поставлен неверно:
 * не влезает ни один набор, даже самый дешёвый (`get_context` — 856). А сжать поверхность
 * редактора вдвое, чтобы вместить `choose_api + find_recipe + search_docs` (2858), нельзя без
 * потери того, ради чего эти описания писались.
 *
 * Отсюда разворот: модель получает ОДИН инструмент со своим коротким описанием, а
 * последовательность `choose_api → find_recipe → search_docs` исполняется внутри него — кодом,
 * а не моделью.
 *
 * **Меряется настоящий фасад, а не его модель.** Стратегия зовёт `askReformer` из `core/facade`
 * — тот самый код, который поедет к консумету, — а не воспроизводит его логику здесь. Первая
 * редакция повторяла каскад в файле стратегии, и это уже было ошибкой по существу: замер
 * подтверждал бы поведение, которого в проде нет. Побочное следствие — метрика ловит и то, чего
 * рукописная копия не знала: реальный фасад режет ответ через `assemble` (по строкам, с
 * добивкой код-фенса), а не срезом по символам.
 *
 * Отсюда же и разница в устройстве: `client` не используется — в браузере stdio нет вовсе, и
 * прямой вызов ядра ближе к проду, чем round-trip через транспорт.
 *
 * Что означают метрики здесь:
 *
 *  - `calls` = 1 всегда. Модель делает одно обращение; внутренние шаги её контекста не касаются
 *    и шагов хода не тратят.
 *  - `chars` — длина ТОЛЬКО того ответа, который уходит модели. Промежуточные ответы каскада
 *    остаются внутри и не оплачиваются. Именно этим фасад дешевле набора: там каждый неудачный
 *    шаг ложился в контекст и оставался в нём до конца хода.
 *  - `firstPass === hit` по построению: переформулировать нечего, заход всегда один.
 *
 * Ответ ограничен `TOOL_TEXT_BUDGET` консумента — без этого метрика была бы завышенной ровно
 * на длинных рецептах (замерено: 18 ответов из 49 длиннее бюджета, максимум 9896 символов).
 *
 * Поверхность самого фасада здесь не считается (`export const tools` отсутствует намеренно):
 * его описание живёт в билдере, а не в `tools/list` сервера, и сравнивать его надо с бюджетом
 * билдера, а не со статикой MCP.
 */

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { matched } from '../lib/match.mjs';

const require = createRequire(import.meta.url);
const distDir = path.resolve(path.dirname(require.resolve('../../package.json')), 'dist');

const { askReformer } = await import(pathToFileURL(path.join(distDir, 'core/facade.js')).href);
const { cliKnowledge } = await import(
  pathToFileURL(path.join(distDir, 'platform/cli/knowledge.js')).href
);

export const name = 'builder-facade';
export const description = 'один вызов консумента; choose_api → find_recipe → search_docs внутри';

/** Бюджет ответа инструмента у консумента: projects/reformer-builder/src/agent/core/types.ts. */
const TOOL_TEXT_BUDGET = 1500;

const knowledge = cliKnowledge();

export async function run(_client, task) {
  const trace = [];
  let calls = 0;
  let chars = 0;
  let ms = 0;
  let hit = false;
  let firstPass = false;

  // Условия те же, что у наборов. Агент задаёт вопрос своими словами (`task`), а не готовым
  // поисковым запросом; не помогло — переформулирует и спрашивает СНОВА, и это отдельный вызов.
  //
  // Первая редакция стратегии подавала фасаду `queries` сразу, внутри одного «вызова», и
  // получала 98% — цифра была завышена дважды: фасад пользовался формулировками, которых
  // модель ему не даёт, и переборы не считались обращениями. Честный первый заход — `task` и
  // первая переформулировка, ровно как в `v6-choose`.
  const attempts = [task.task, ...task.queries];

  for (let i = 0; i < attempts.length; i++) {
    const started = Date.now();
    const answer = await askReformer(knowledge, attempts[i], {
      target: task.target,
      maxChars: TOOL_TEXT_BUDGET,
    });
    ms += Date.now() - started;
    calls++;
    chars += answer.text.length;

    const found = matched(answer.text, task.expectAny).length > 0;

    // Внутренние шаги — в трассу: по ним видно, на каком этапе каскада нашлось знание, и это
    // единственный способ заметить, что, например, `choose_api` перестал срабатывать.
    for (const s of answer.trace) {
      trace.push({ tool: `inner:${s.tool}`, arg: attempts[i], chars: s.chars, hit: s.hit });
    }
    trace.push({ tool: 'facade', arg: attempts[i], chars: answer.text.length, hit: found });

    if (found) {
      hit = true;
      if (i <= 1) firstPass = true;
      break;
    }
  }

  return { hit, firstPass, calls, chars, ms, trace };
}
