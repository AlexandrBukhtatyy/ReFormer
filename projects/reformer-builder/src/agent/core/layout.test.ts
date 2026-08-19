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

  it('правка одной плотности не роняет адаптивную раскладку', () => {
    // Ось менять не просили — брейкпоинт-варианты остаются на месте (раньше ось пересобиралась
    // из голых токенов, и `md:grid-cols-2` молча исчезал).
    expect(tokens(layoutClassName({ gap: 'lg' }, 'grid grid-cols-1 md:grid-cols-2 gap-4'))).toEqual(
      ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-6']
    );
  });

  it('явная смена оси снимает и адаптивные оси-токены', () => {
    // Иначе на широком экране продолжал бы действовать старый вариант — команда выглядела бы
    // как не сработавшая.
    expect(
      tokens(layoutClassName({ columns: 3 }, 'grid grid-cols-1 md:grid-cols-2 gap-4'))
    ).toEqual(['grid', 'grid-cols-3', 'gap-4']);
    expect(tokens(layoutClassName({ direction: 'column' }, 'flex md:flex-row gap-4'))).toEqual([
      'flex',
      'flex-col',
      'gap-4',
    ]);
  });

  it('адаптивные отступы: остаются без явной плотности, снимаются с ней', () => {
    expect(tokens(layoutClassName({ direction: 'row' }, 'flex md:gap-6 gap-4'))).toEqual([
      'md:gap-6',
      'flex',
      'gap-4',
    ]);
    expect(tokens(layoutClassName({ direction: 'row', gap: 'sm' }, 'flex md:gap-6 gap-4'))).toEqual(
      ['flex', 'gap-2']
    );
  });

  it('оформление с вариантом остаётся оформлением', () => {
    expect(tokens(layoutClassName({ gap: 'sm' }, 'md:p-6 flex gap-4'))).toEqual([
      'md:p-6',
      'flex',
      'gap-2',
    ]);
  });
});
