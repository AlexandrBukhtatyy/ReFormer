import { describe, expect, it } from 'vitest';
import {
  baseUtility,
  gridColumnsOf,
  hasVariant,
  isAxisToken,
  isGapToken,
  variantsOf,
} from './tw-tokens';

describe('baseUtility / variantsOf', () => {
  it('токен без вариантов остаётся собой', () => {
    expect(baseUtility('grid-cols-2')).toBe('grid-cols-2');
    expect(variantsOf('grid-cols-2')).toEqual([]);
    expect(hasVariant('grid-cols-2')).toBe(false);
  });

  it('брейкпоинт и цепочка вариантов отрезаются', () => {
    expect(baseUtility('md:grid-cols-2')).toBe('grid-cols-2');
    expect(variantsOf('dark:md:flex')).toEqual(['dark', 'md']);
    expect(hasVariant('md:grid-cols-2')).toBe(true);
  });

  it('двоеточие внутри произвольного значения не разделитель', () => {
    // Иначе `md:[grid-template-columns:1fr_2fr]` распался бы по двоеточию CSS-свойства.
    expect(baseUtility('md:[grid-template-columns:1fr_2fr]')).toBe(
      '[grid-template-columns:1fr_2fr]'
    );
    expect(variantsOf('md:[grid-template-columns:1fr_2fr]')).toEqual(['md']);
    // ...а `[&:hover]:flex` — по псевдоклассу в селекторе.
    expect(baseUtility('[&:hover]:flex')).toBe('flex');
    expect(baseUtility('supports-[display:grid]:grid')).toBe('grid');
  });
});

describe('gridColumnsOf', () => {
  it('число колонок читается и из варианта', () => {
    expect(gridColumnsOf('grid-cols-3')).toBe(3);
    expect(gridColumnsOf('lg:grid-cols-12')).toBe(12);
  });

  it('не про колонки — undefined', () => {
    expect(gridColumnsOf('flex')).toBeUndefined();
    expect(gridColumnsOf('grid-rows-2')).toBeUndefined();
    // Произвольное значение числом не выражается.
    expect(gridColumnsOf('grid-cols-[1fr_2fr]')).toBeUndefined();
  });
});

describe('isAxisToken / isGapToken', () => {
  it('ось — display, направление flex и грид-дорожки, в любом варианте', () => {
    for (const t of ['flex', 'grid', 'flex-col', 'md:flex-row', 'lg:grid-cols-4', 'grid-rows-2']) {
      expect(isAxisToken(t), t).toBe(true);
    }
  });

  it('оформление осью не считается', () => {
    for (const t of ['bg-white', 'rounded-lg', 'gap-4', 'items-center', 'md:p-6']) {
      expect(isAxisToken(t), t).toBe(false);
    }
  });

  it('плотность — gap и space, в любом варианте', () => {
    for (const t of ['gap-4', 'gap-x-2', 'space-y-6', 'md:gap-6'])
      expect(isGapToken(t), t).toBe(true);
    for (const t of ['flex', 'grid-cols-2', 'p-4']) expect(isGapToken(t), t).toBe(false);
  });
});
