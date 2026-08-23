/**
 * Unit tests for the find_recipe tool.
 * - defect 78: ranked doc-filename matching (exact > segment > prefix > substring),
 *   numeric NN- prefix must not participate in matching.
 * - defect 79: missing / non-string `topic` must degrade to a friendly message
 *   instead of throwing an unhandled TypeError.
 * - раскладка файлов формы: топики, с которых агент НАЧИНАЕТ работу над формой, обязаны
 *   вести в гайд раскладки, а не в API одноимённого символа.
 */

import { describe, it, expect } from 'vitest';
import { scoreDocFileMatch, pickBestDocFile, findRecipeTool } from '../src/core/tools/find-recipe';
import type { FindRecipeArgs } from '../src/core/tools/find-recipe';
import { normalizeTopic, listAvailablePackages } from '../src/utils/docs-parser';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

/** Знание процесса: тесты гоняются в Node, поэтому источники — те же, что у сервера. */
const k = cliKnowledge();

const hasDocs = listAvailablePackages().length > 0;

describe('scoreDocFileMatch / pickBestDocFile — ranked matching (defect 78)', () => {
  it('prefers an exact stem match over an earlier loose substring match', () => {
    // The old first-match-wins loop returned "05-loose-recipes-extra.md" because it
    // .includes("recipes") and comes first in readdir order; the exact "10-recipes.md"
    // that appears later was shadowed. Ranking must surface the exact match.
    const entries = ['05-loose-recipes-extra.md', '10-recipes.md'];
    expect(pickBestDocFile(entries, 'recipes')).toBe('10-recipes.md');
  });

  it('does not match a topic against the numeric NN- prefix', () => {
    expect(scoreDocFileMatch('05-recipes.md', '05')).toBe(0);
    expect(pickBestDocFile(['05-recipes.md', '01-api-reference.md'], '05')).toBeNull();
  });

  it('ranks exact (100) > whole segment (75) > prefix (60) > substring (40)', () => {
    expect(scoreDocFileMatch('05-recipes.md', 'recipes')).toBe(100);
    expect(scoreDocFileMatch('03-api-signatures.md', 'api')).toBe(75); // whole hyphen segment
    expect(scoreDocFileMatch('05-recipes.md', 'recipe')).toBe(60); // stem prefix
    expect(scoreDocFileMatch('10-form-arrays.md', 'array')).toBe(40); // inner substring of "arrays"
    expect(scoreDocFileMatch('05-recipes.md', 'zzz')).toBe(0);
  });

  it('matches the full NN-prefixed stem exactly', () => {
    expect(scoreDocFileMatch('05-recipes.md', '05-recipes')).toBe(100);
  });

  it('keeps curated NN- order on ties (lower file number wins among equal scores)', () => {
    // Both are whole-segment "api" matches (score 75) → first/lowest NN wins,
    // which is the intended curated priority, not accidental readdir order.
    const entries = ['01-api-reference.md', '03-api-signatures.md'];
    expect(pickBestDocFile(entries, 'api')).toBe('01-api-reference.md');
  });

  it('returns null when nothing matches', () => {
    expect(pickBestDocFile(['05-recipes.md', '10-arrays.md'], 'nonexistent')).toBeNull();
  });

  // Regression: hyphen/underscore-insensitive matching. The report found 21 advertised
  // aliases dead because the dashed multi-word form did not resolve while the joined form
  // did ("formfield" ✓ / "form-field" ✗). Normalization must make both match the file.
  it('matches hyphen/underscore variants against a dashed filename (regression)', () => {
    expect(scoreDocFileMatch('04-form-field.md', 'form-field')).toBe(100); // exact
    expect(scoreDocFileMatch('04-form-field.md', 'formfield')).toBe(90); // dash-insensitive
    expect(scoreDocFileMatch('04-form-field.md', 'form_field')).toBe(90); // underscore too
    expect(pickBestDocFile(['04-form-field.md'], 'formfield')).toBe('04-form-field.md');
  });
});

describe('normalizeTopic (regression: dashed aliases)', () => {
  it('strips case, hyphens, underscores and spaces', () => {
    expect(normalizeTopic('Form-Field')).toBe('formfield');
    expect(normalizeTopic('enable_when')).toBe('enablewhen');
    expect(normalizeTopic('project structure')).toBe('projectstructure');
  });
});

describe('findRecipeTool — алиасы раскладки файлов формы', () => {
  /** Топики, с которых агент начинает работу над формой, а не ищет раскладку по имени. */
  const START_OF_WORK = ['create-form', 'file-naming', 'naming', 'form-files'];

  it.runIf(hasDocs)('топики старта работы ведут в гайд раскладки', async () => {
    // Замерено (`.tmp/layout-check/report.md`): `create-form` — самая естественная
    // формулировка на старте — резолвился секцией `### createForm API` пакета core (шаг 2
    // каскада) и уводил на API; `naming` уходил в core/common-patterns, `form-files` — в
    // cdk/typed-item-access. Раскладку и имена файлов агент после этого придумывал сам.
    for (const topic of START_OF_WORK) {
      const { content } = await findRecipeTool({ topic }, k);
      expect(content[0].text, `топик "${topic}" не привёл в гайд раскладки`).toContain(
        'docs/llms/06-form-directory-layout.md'
      );
    }
  });

  it.runIf(hasDocs)('гайд доезжает вместе с поимённым набором файлов', async () => {
    // Ссылки на файл мало: расхождение чинится переименованием, значит имена обязаны быть
    // в теле ответа, а не за ещё одним вызовом. Потолок рецепта не должен их срезать.
    const { content } = await findRecipeTool({ topic: 'create-form' }, k);
    for (const file of ['form.behavior.ts', 'validation.ts', 'data-sources.ts']) {
      expect(content[0].text, `имя ${file} не доехало до агента`).toContain(file);
    }
  });

  it.runIf(hasDocs)('`directory-layout` довозит §1 целиком, вместе с блоком «Rules:»', async () => {
    // Два РАЗНЫХ усечения легко перепутать. Здесь работает только одно: рецепт возвращает файл
    // `06-form-directory-layout.md` целиком и режет его по бюджету (capRecipe, 10 000 симв.) —
    // по границе раздела, так что §1 доезжает нетронутым, а отваливаются §3+. Второе усечение —
    // обрыв §1 на `#`-строке внутри блока кода — жило в разборе `llms.txt` и рецепта не
    // касалось (см. tests/docs-sections.test.ts). Тест держит границу: если бюджет когда-нибудь
    // опустят или сортировку разделов поменяют, контракт именования пропадёт молча.
    const { content } = await findRecipeTool({ topic: 'directory-layout' }, k);
    expect(content[0].text).toContain('docs/llms/06-form-directory-layout.md');
    expect(content[0].text).toContain('Rules:');
    expect(content[0].text).toContain('All steps inline in `index.tsx`');
  });

  it.runIf(hasDocs)('подмена топика помечена в ответе', async () => {
    // Молчаливый редирект хуже промаха: агент не поймёт, почему получил не то, что просил.
    const { content } = await findRecipeTool({ topic: 'create-form' }, k);
    expect(content[0].text).toMatch(/matched alias.*form-directory-layout/);
  });

  it.runIf(hasDocs)('`layout` по-прежнему уходит в ui-kit, а не в раскладку модуля', async () => {
    // `layout` намеренно НЕ алиасится (см. комментарий в RECIPE_ALIASES): визуальная
    // раскладка полей — это ui-kit, и новые алиасы не должны её перехватывать.
    const { content } = await findRecipeTool({ topic: 'layout' }, k);
    expect(content[0].text).toContain('@reformer/ui-kit');
  });

  it.runIf(hasDocs)('соседние топики не задеты', async () => {
    const untouched: Array<[string, string]> = [
      ['form-layout', '@reformer/ui-kit'],
      ['spacing', '@reformer/ui-kit'],
      ['project-structure', '@reformer/core'],
    ];
    for (const [topic, pkg] of untouched) {
      const { content } = await findRecipeTool({ topic }, k);
      expect(content[0].text, `топик "${topic}" уехал из ${pkg}`).toContain(pkg);
    }
  });
});

describe('findRecipeTool — missing / invalid topic guard (defect 79)', () => {
  it('returns a friendly message instead of throwing when topic is omitted', async () => {
    const res = await findRecipeTool({} as unknown as FindRecipeArgs, k);
    expect(res.content[0].text).toMatch(/topic.*required/i);
  });

  it('does not throw when topic is a non-string', async () => {
    const res = await findRecipeTool({ topic: 123 } as unknown as FindRecipeArgs, k);
    expect(res.content[0].text).toMatch(/topic.*required/i);
  });

  it('still rejects an empty-string topic with the same friendly message', async () => {
    const res = await findRecipeTool({ topic: '   ' }, k);
    expect(res.content[0].text).toMatch(/topic.*required/i);
  });
});
