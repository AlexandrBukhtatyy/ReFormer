/**
 * Unit tests for the find_recipe tool.
 * - defect 78: ranked doc-filename matching (exact > segment > prefix > substring),
 *   numeric NN- prefix must not participate in matching.
 * - defect 79: missing / non-string `topic` must degrade to a friendly message
 *   instead of throwing an unhandled TypeError.
 */

import { describe, it, expect } from 'vitest';
import { scoreDocFileMatch, pickBestDocFile, findRecipeTool } from '../src/tools/find-recipe';
import type { FindRecipeArgs } from '../src/tools/find-recipe';

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
});

describe('findRecipeTool — missing / invalid topic guard (defect 79)', () => {
  it('returns a friendly message instead of throwing when topic is omitted', async () => {
    const res = await findRecipeTool({} as unknown as FindRecipeArgs);
    expect(res.content[0].text).toMatch(/topic.*required/i);
  });

  it('does not throw when topic is a non-string', async () => {
    const res = await findRecipeTool({ topic: 123 } as unknown as FindRecipeArgs);
    expect(res.content[0].text).toMatch(/topic.*required/i);
  });

  it('still rejects an empty-string topic with the same friendly message', async () => {
    const res = await findRecipeTool({ topic: '   ' });
    expect(res.content[0].text).toMatch(/topic.*required/i);
  });
});
