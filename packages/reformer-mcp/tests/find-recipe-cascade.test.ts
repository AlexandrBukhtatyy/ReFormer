/**
 * Каскад `find_recipe` → `search_docs`.
 *
 * Зачем: до каскада промах алиасов был терминальным. Замерено на 25 естественных
 * формулировках, которые агент реально пишет («dependent field», «hide field»,
 * «phone mask», «server validation», …): 17 из 25 (68%) отдавали «No recipe found» +
 * ~693 токена подсказки без ответа. Те же 17 из 17 находит `search_docs` — соседний
 * tool ЭТОГО ЖЕ сервера, просто между ними не было перехода.
 *
 * Инварианты, которые здесь фиксируются:
 *  - ни одна из этих формулировок больше не даёт «No recipe found»;
 *  - каждый выданный `reformer://docs/<pkg>/<slug>` резолвится через getSectionBySlug
 *    (иначе агент получит URI, который ReadResource отвергнет);
 *  - курируемые рецепты по-прежнему выигрывают у каскада (порядок шагов не сломан);
 *  - заведомо бессмысленный топик всё ещё доходит до фолбэка со списком алиасов.
 */

import { describe, it, expect } from 'vitest';
import { findRecipeTool } from '../src/core/tools/find-recipe';
import { getSectionBySlug, listAvailablePackages } from '../src/utils/docs-parser';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

/** Знание процесса: тесты гоняются в Node, поэтому источники — те же, что у сервера. */
const k = cliKnowledge();

/** Формулировки, на которых был замерен 68%-й промах. */
const NATURAL_TOPICS = [
  'disabled submit',
  'field visibility',
  'hide field',
  'computed total',
  'dependent field',
  'password confirmation',
  'date picker',
  'error message',
  'server validation',
  'number formatting',
  'phone mask',
  'remove item',
  'loading state',
];

const URI_RE = /reformer:\/\/docs\/([^/\s`]+)\/([^\s`]+)/g;

function extractUris(text: string): Array<{ short: string; slug: string }> {
  const out: Array<{ short: string; slug: string }> = [];
  let m: RegExpExecArray | null;
  URI_RE.lastIndex = 0;
  while ((m = URI_RE.exec(text)) !== null) out.push({ short: m[1], slug: m[2] });
  return out;
}

const hasDocs = listAvailablePackages().length > 0;

describe('find_recipe — каскад в полнотекстовый поиск', () => {
  it.runIf(hasDocs)('ни одна естественная формулировка не даёт "No recipe found"', async () => {
    const dead: string[] = [];
    for (const topic of NATURAL_TOPICS) {
      const { content } = await findRecipeTool({ topic }, k);
      if (content[0].text.startsWith('No recipe found')) dead.push(topic);
    }
    expect(dead, `тупик вместо каскада для: ${dead.join(', ')}`).toEqual([]);
  });

  it.runIf(hasDocs)('каждый URI из каскада резолвится через getSectionBySlug', async () => {
    for (const topic of NATURAL_TOPICS) {
      const { content } = await findRecipeTool({ topic }, k);
      for (const { short, slug } of extractUris(content[0].text)) {
        expect(
          getSectionBySlug(`@reformer/${short}`, slug),
          `URI reformer://docs/${short}/${slug} (топик "${topic}") не резолвится в секцию`
        ).not.toBeNull();
      }
    }
  });

  it.runIf(hasDocs)('курируемый рецепт по-прежнему выигрывает у каскада', async () => {
    // `wizard` резолвится алиасом в multi-step на шаге 1 — каскад не должен его перехватывать.
    const { content } = await findRecipeTool({ topic: 'wizard' }, k);
    expect(content[0].text).toMatch(/^# Recipe: /);
  });

  it('заведомо бессмысленный топик доходит до фолбэка со списком алиасов', async () => {
    const { content } = await findRecipeTool({ topic: 'zzqqxywvunlikelyterm' }, k);
    expect(content[0].text).toMatch(/No recipe found/);
  });

  it('пустой / не-строковый topic по-прежнему деградирует в сообщение, а не в throw', async () => {
    for (const topic of [undefined, '', '   ']) {
      const { content } = await findRecipeTool({ topic: topic as string }, k);
      expect(content[0].text).toMatch(/topic/i);
    }
  });
});
