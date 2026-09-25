import { describe, expect, it } from 'vitest';

import { editDistance, nearestName } from './nearest';

const CATALOG = ['Input', 'Select', 'Checkbox', 'Box', 'Card', 'TypographyBlockquote'];

describe('ближайшее имя', () => {
  it('находит опечатку в одну букву', () => {
    expect(nearestName(CATALOG, 'Inpt')).toBe('Input');
  });

  it('промах регистра — то же имя, а не пять правок', () => {
    expect(nearestName(CATALOG, 'input')).toBe('Input');
    expect(nearestName(CATALOG, 'CHECKBOX')).toBe('Checkbox');
  });

  it('известное имя исправлять нечего', () => {
    expect(nearestName(CATALOG, 'Input')).toBeUndefined();
  });

  it('далёкое имя не подсказывается: предложение хуже молчания', () => {
    // Без порога ближайшим к «Foo» оказался бы «Box», и ассистент послушно применил бы это.
    expect(nearestName(CATALOG, 'Foo')).toBeUndefined();
    expect(nearestName(CATALOG, 'СовершенноДругое')).toBeUndefined();
  });

  it('длинному имени порог позволяет больше правок, короткому — меньше', () => {
    expect(nearestName(CATALOG, 'TypografyBlockquot')).toBe('TypographyBlockquote');
    expect(nearestName(['Box'], 'Bxo')).toBe('Box');
    expect(nearestName(['Box'], 'Bxoy')).toBeUndefined();
  });

  it('при равном расстоянии выигрывает первый по каталогу: порядок там курируемый', () => {
    expect(nearestName(['Card', 'Cart'], 'Carx')).toBe('Card');
  });

  it('пустой список кандидатов ответа не даёт', () => {
    expect(nearestName([], 'Input')).toBeUndefined();
  });
});

describe('расстояние с ранним выходом', () => {
  it('считает правки', () => {
    expect(editDistance('Input', 'Input', 3)).toBe(0);
    expect(editDistance('Inpt', 'Input', 3)).toBe(1);
    expect(editDistance('Selct', 'Select', 3)).toBe(1);
  });

  it('за порогом отвечает «дальше порога», а не точное число', () => {
    expect(editDistance('Box', 'TypographyBlockquote', 2)).toBeGreaterThan(2);
  });
});
