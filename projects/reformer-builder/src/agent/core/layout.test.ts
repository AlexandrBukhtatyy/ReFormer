import { describe, expect, it } from 'vitest';
import { layoutClassName } from './layout';

const tokens = (cls: string) => cls.split(/\s+/).filter(Boolean);

describe('layoutClassName', () => {
  it('в строку и в столбец', () => {
    expect(tokens(layoutClassName({ direction: 'row' }))).toEqual(['flex', 'gap-4']);
    expect(tokens(layoutClassName({ direction: 'column' }))).toEqual(['flex', 'flex-col', 'gap-4']);
  });

  it('сетка имеет приоритет над осью', () => {
    expect(tokens(layoutClassName({ direction: 'row', columns: 3 }))).toEqual([
      'grid',
      'grid-cols-3',
      'gap-4',
    ]);
  });

  it('плотность переводится в токен', () => {
    expect(layoutClassName({ direction: 'row', gap: 'lg' })).toContain('gap-6');
    expect(layoutClassName({ direction: 'row', gap: 'none' })).toContain('gap-0');
  });

  it('классы оформления сохраняются, раскладочные — переписываются', () => {
    const next = layoutClassName({ direction: 'row' }, 'bg-white flex-col rounded-lg space-y-4');
    expect(tokens(next)).toContain('bg-white');
    expect(tokens(next)).toContain('rounded-lg');
    expect(tokens(next)).not.toContain('flex-col');
    expect(tokens(next)).not.toContain('space-y-4');
  });

  it('без direction и columns ось сохраняется — меняется только плотность', () => {
    expect(tokens(layoutClassName({ gap: 'sm' }, 'flex gap-4'))).toEqual(['flex', 'gap-2']);
    expect(tokens(layoutClassName({ gap: 'sm' }, 'grid grid-cols-3 gap-4'))).toEqual([
      'grid',
      'grid-cols-3',
      'gap-2',
    ]);
  });

  it('без gap сохраняется текущая плотность', () => {
    expect(layoutClassName({ direction: 'row' }, 'flex flex-col gap-6')).toContain('gap-6');
  });
});
