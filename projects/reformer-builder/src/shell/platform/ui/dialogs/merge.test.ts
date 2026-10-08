import { describe, expect, it } from 'vitest';

import { planMerge, type MergeSides } from '@/shell/platform/workspace/merge/resolve';
import { columnOf, describeMergeDialog, validateManualMerge } from './merge';

const sidesOf = (partial: Partial<MergeSides>): MergeSides => ({
  base: 'a\nb\nc',
  ours: 'a\nНАШЕ\nc',
  theirs: 'a\nИХ\nc',
  theirsRevision: 'r9',
  ...partial,
});

const model = (partial: Partial<MergeSides>) => {
  const sides = sidesOf(partial);
  return describeMergeDialog(sides, planMerge(sides));
};

describe('колонки диалога', () => {
  it('колонок всегда три и всегда в одном порядке', () => {
    expect(model({}).columns.map((column) => column.id)).toEqual(['base', 'ours', 'theirs']);
  });

  it('колонка источника заполнена — данные до неё доехали', () => {
    const theirs = columnOf(model({}), 'theirs');
    expect(theirs.available).toBe(true);
    expect(theirs.lines).toEqual(['a', 'ИХ', 'c']);
  });

  it('счётчики считаются от основания, у самого основания — нули', () => {
    const dialog = model({ base: 'a\nb\nc', ours: 'a\nX\nY\nc', theirs: 'a\nc' });
    expect(columnOf(dialog, 'base')).toMatchObject({ added: 0, removed: 0 });
    expect(columnOf(dialog, 'ours')).toMatchObject({ added: 2, removed: 1 });
    expect(columnOf(dialog, 'theirs')).toMatchObject({ added: 0, removed: 1 });
  });

  it('основания нет — колонка пуста и помечена как пустая, а не выдумана', () => {
    const dialog = model({ base: null });
    expect(columnOf(dialog, 'base')).toMatchObject({ available: false, lines: [] });
    // Считать «от несуществующего основания» нечего — весь текст добавлен.
    expect(columnOf(dialog, 'ours').added).toBe(3);
  });

  it('файла в источнике нет — колонка источника помечена пустой', () => {
    const dialog = model({ theirs: null });
    expect(columnOf(dialog, 'theirs').available).toBe(false);
  });

  it('колонки по несуществующему имени нет — это ошибка вызывающего', () => {
    // @ts-expect-error проверяется поведение в рантайме, а не тип
    expect(() => columnOf(model({}), 'нету')).toThrow();
  });
});

describe('исходы', () => {
  it('три исхода, когда есть с чем сливаться', () => {
    expect(model({}).choices).toEqual(['ours', 'theirs', 'merged']);
  });

  it('исхода по умолчанию нет: выбор всегда явный', () => {
    // Список исходов — именно список, а не «первый выбран». Проверяется тем, что модель
    // не несёт поля «выбранное»: выбрать за человека нечем.
    expect(Object.keys(model({}))).not.toContain('selected');
  });

  it('файл исчез из источника — остаётся только «оставить свою»', () => {
    const dialog = model({ theirs: null });
    expect(dialog.choices).toEqual(['ours']);
    expect(dialog.reason).toBe('gone');
  });
});

describe('заготовка ручного слияния', () => {
  it('это слитый текст с разметкой, а не одна из сторон', () => {
    const dialog = model({});
    expect(dialog.conflicts).toBe(1);
    expect(dialog.seed).toContain('<<<<<<<');
    expect(dialog.seed).toContain('НАШЕ');
    expect(dialog.seed).toContain('ИХ');
    expect(dialog.seed).toContain('b');
  });

  it('без разметки заготовка — слитый текст: править конфликт не нужно, а посмотреть можно', () => {
    const sides = sidesOf({ base: 'a\nb\nc', ours: 'A\nb\nc', theirs: 'a\nb\nC' });
    // Слияние чистое, но разбор отказал — диалог всё равно нужен.
    const plan = planMerge(sides, () => ({ ok: false, message: 'json.unexpected-token' }));
    const dialog = describeMergeDialog(sides, plan);
    expect(dialog.reason).toBe('unparsable');
    expect(dialog.failure).toBe('json.unexpected-token');
    expect(dialog.seed).toBe('A\nb\nC');
    expect(dialog.conflicts).toBe(0);
  });

  it('сливать не с чем — заготовка равна нашей версии', () => {
    const dialog = model({ theirs: null, ours: 'наше' });
    expect(dialog.seed).toBe('наше');
  });
});

describe('где именно правка', () => {
  it('у каждой стороны помечены строки, которых нет в основании', () => {
    const dialog = model({ base: 'a\nb\nc', ours: 'A\nb\nc', theirs: 'a\nb\nновая\nC' });

    expect(columnOf(dialog, 'ours').changed).toEqual([0]);
    expect(columnOf(dialog, 'theirs').changed).toEqual([2, 3]);
    // Основание — точка отсчёта: отмечать в нём нечего.
    expect(columnOf(dialog, 'base').changed).toEqual([]);
  });

  it('без основания не помечено ничего: «изменено всё» колонке сказать нечего', () => {
    const dialog = model({ base: null, ours: 'a\nb', theirs: 'c\nd' });

    expect(columnOf(dialog, 'ours').changed).toEqual([]);
    expect(columnOf(dialog, 'theirs').changed).toEqual([]);
  });
});

describe('готовое слияние', () => {
  it('правки не пересеклись и результат разобрался — слияние предложено готовым исходом', () => {
    // Диалог открывают и здесь: на сохранении спрашивают всегда, а не только при споре.
    const dialog = model({ base: 'a\nb\nc', ours: 'A\nb\nc', theirs: 'a\nb\nC' });

    expect(dialog.reason).toBe('mergeable');
    expect(dialog.mergedText).toBe('A\nb\nC');
    // Тот же текст — заготовка ручного слияния: его можно и поправить перед записью.
    expect(dialog.seed).toBe('A\nb\nC');
    expect(dialog.conflicts).toBe(0);
    expect(dialog.choices).toEqual(['ours', 'theirs', 'merged']);
  });

  it('спорный участок или неразобранный результат готовым исходом не предлагаются', () => {
    expect(model({}).mergedText).toBeUndefined();

    const sides = sidesOf({ base: 'a\nb\nc', ours: 'A\nb\nc', theirs: 'a\nb\nC' });
    const unparsable = planMerge(sides, () => ({ ok: false, message: 'json.unexpected-token' }));
    expect(describeMergeDialog(sides, unparsable).mergedText).toBeUndefined();
  });
});

describe('приём ручного слияния', () => {
  it('оставшаяся разметка не даёт подтвердить', () => {
    expect(validateManualMerge('a\n<<<<<<< наша версия\nb')).toBe('markers');
    expect(validateManualMerge('=======')).toBe('markers');
  });

  it('текст без разметки принимается, включая пустой', () => {
    expect(validateManualMerge('готовый текст')).toBe('ok');
    expect(validateManualMerge('')).toBe('ok');
  });

  it('заготовка с конфликтом сама по себе не принимается', () => {
    expect(validateManualMerge(model({}).seed)).toBe('markers');
  });
});
