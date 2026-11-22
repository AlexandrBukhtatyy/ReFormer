import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MARKERS,
  diffLines,
  diffStat,
  hasChanges,
  hasConflictMarkers,
  LCS_CELL_BUDGET,
  mergeThreeWay,
  type MergeRegionKind,
} from './text-merge';

/** Текст из строк — тесты читаются по строкам, а сравниваются по тексту. */
const lines = (...items: readonly string[]): string => items.join('\n');

/** Виды участков подряд: по ним видно форму разбора, а не только итоговый текст. */
const kinds = (regions: readonly { kind: MergeRegionKind }[]): readonly MergeRegionKind[] =>
  regions.map((region) => region.kind);

describe('построчный diff', () => {
  it('совпадающие строки помечены `same`, различия — парой del/add', () => {
    const ops = diffLines(lines('a', 'b', 'c'), lines('a', 'X', 'c'));
    expect(ops).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'X' },
      { type: 'same', text: 'c' },
    ]);
  });

  it('вставка не порождает удалений', () => {
    const ops = diffLines(lines('a', 'c'), lines('a', 'b', 'c'));
    expect(ops).toEqual([
      { type: 'same', text: 'a' },
      { type: 'add', text: 'b' },
      { type: 'same', text: 'c' },
    ]);
  });

  it('счётчик считает строки, а не участки', () => {
    const ops = diffLines(lines('a', 'b', 'c'), lines('a', 'X', 'Y', 'Z'));
    expect(diffStat(ops)).toEqual({ added: 3, removed: 2 });
  });

  it('пустой текст — одна пустая строка, а не отсутствие строк', () => {
    expect(diffLines('', '')).toEqual([{ type: 'same', text: '' }]);
    expect(diffStat(diffLines('', 'a'))).toEqual({ added: 1, removed: 1 });
  });

  it('вопрос «есть ли изменения» отвечается без diff’а', () => {
    expect(hasChanges('a', 'a')).toBe(false);
    expect(hasChanges('a', 'b')).toBe(true);
  });
});

describe('слияние: стороны согласны', () => {
  it('все три одинаковы — один стабильный участок и тот же текст', () => {
    const result = mergeThreeWay(lines('a', 'b'), lines('a', 'b'), lines('a', 'b'));
    expect(result.clean).toBe(true);
    expect(result.text).toBe(lines('a', 'b'));
    expect(kinds(result.regions)).toEqual(['stable']);
  });

  it('правка только у нас — берётся наша', () => {
    const result = mergeThreeWay(lines('a', 'b'), lines('a', 'X'), lines('a', 'b'));
    expect(result.clean).toBe(true);
    expect(result.text).toBe(lines('a', 'X'));
    expect(kinds(result.regions)).toEqual(['stable', 'ours']);
  });

  it('правка только у источника — берётся его', () => {
    const result = mergeThreeWay(lines('a', 'b'), lines('a', 'b'), lines('a', 'Y'));
    expect(result.clean).toBe(true);
    expect(result.text).toBe(lines('a', 'Y'));
    expect(kinds(result.regions)).toEqual(['stable', 'theirs']);
  });

  it('совпадающие правки берутся ОДИН раз, а не дважды', () => {
    const result = mergeThreeWay(
      lines('a', 'b', 'c'),
      lines('a', 'ЖИРНО', 'c'),
      lines('a', 'ЖИРНО', 'c')
    );
    expect(result.clean).toBe(true);
    expect(result.text).toBe(lines('a', 'ЖИРНО', 'c'));
    expect(kinds(result.regions)).toEqual(['stable', 'both', 'stable']);
  });

  it('совпадающие вставки в одну точку тоже не удваиваются', () => {
    const result = mergeThreeWay(lines('a', 'z'), lines('a', 'new', 'z'), lines('a', 'new', 'z'));
    expect(result.clean).toBe(true);
    expect(result.text).toBe(lines('a', 'new', 'z'));
  });
});

describe('слияние: правки не пересеклись', () => {
  it('правки в разных концах файла соединяются', () => {
    const base = lines('заголовок', '1', '2', '3', 'подвал');
    const ours = lines('ЗАГОЛОВОК', '1', '2', '3', 'подвал');
    const theirs = lines('заголовок', '1', '2', '3', 'ПОДВАЛ');
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.clean).toBe(true);
    expect(result.text).toBe(lines('ЗАГОЛОВОК', '1', '2', '3', 'ПОДВАЛ'));
    expect(kinds(result.regions)).toEqual(['ours', 'stable', 'theirs']);
  });

  it('правки СОСЕДНИХ строк сливаются: соседство — не пересечение', () => {
    const result = mergeThreeWay(lines('a', 'b', 'c'), lines('a', 'X', 'c'), lines('a', 'b', 'Y'));
    expect(result.clean).toBe(true);
    expect(result.text).toBe(lines('a', 'X', 'Y'));
  });

  it('вставка одной стороны и правка другой ниже по файлу', () => {
    const result = mergeThreeWay(
      lines('a', 'b', 'c'),
      lines('a', 'вставка', 'b', 'c'),
      lines('a', 'b', 'C')
    );
    expect(result.clean).toBe(true);
    expect(result.text).toBe(lines('a', 'вставка', 'b', 'C'));
  });

  it('удаление одной стороной строк, которых вторая не трогала', () => {
    const result = mergeThreeWay(
      lines('a', 'b', 'c', 'd'),
      lines('a', 'c', 'd'),
      lines('a', 'b', 'c', 'D')
    );
    expect(result.clean).toBe(true);
    expect(result.text).toBe(lines('a', 'c', 'D'));
  });

  it('обе стороны удалили разные строки', () => {
    const result = mergeThreeWay(
      lines('a', 'b', 'c', 'd'),
      lines('a', 'c', 'd'),
      lines('a', 'b', 'c')
    );
    expect(result.clean).toBe(true);
    expect(result.text).toBe(lines('a', 'c'));
  });
});

describe('слияние: стороны спорят', () => {
  it('разные правки одной строки — конфликт с разметкой', () => {
    const result = mergeThreeWay(
      lines('a', 'b', 'c'),
      lines('a', 'НАШЕ', 'c'),
      lines('a', 'ИХ', 'c')
    );
    expect(result.clean).toBe(false);
    expect(result.conflicts).toBe(1);
    expect(kinds(result.regions)).toEqual(['stable', 'conflict', 'stable']);
    expect(result.text).toBe(
      lines(
        'a',
        `<<<<<<< ${DEFAULT_MARKERS.ours}`,
        'НАШЕ',
        `||||||| ${DEFAULT_MARKERS.base}`,
        'b',
        '=======',
        'ИХ',
        `>>>>>>> ${DEFAULT_MARKERS.theirs}`,
        'c'
      )
    );
  });

  it('правка против удаления — конфликт, а не молчаливый выбор', () => {
    const result = mergeThreeWay(lines('a', 'b', 'c'), lines('a', 'ПРАВКА', 'c'), lines('a', 'c'));
    expect(result.clean).toBe(false);
    expect(result.conflicts).toBe(1);
    const conflict = result.regions.find((region) => region.kind === 'conflict');
    expect(conflict?.ours).toEqual(['ПРАВКА']);
    expect(conflict?.theirs).toEqual([]);
    expect(conflict?.base).toEqual(['b']);
  });

  it('удаление против правки — тот же конфликт с другой стороны', () => {
    const result = mergeThreeWay(lines('a', 'b', 'c'), lines('a', 'c'), lines('a', 'ИХ', 'c'));
    expect(result.clean).toBe(false);
    const conflict = result.regions.find((region) => region.kind === 'conflict');
    expect(conflict?.ours).toEqual([]);
    expect(conflict?.theirs).toEqual(['ИХ']);
  });

  it('разные вставки в одну точку — конфликт', () => {
    const result = mergeThreeWay(lines('a', 'z'), lines('a', 'наше', 'z'), lines('a', 'их', 'z'));
    expect(result.clean).toBe(false);
    expect(result.conflicts).toBe(1);
  });

  it('два конфликта в одном файле считаются порознь', () => {
    const base = lines('1', 'a', '2', 'b', '3');
    const ours = lines('1', 'НАШЕ-A', '2', 'НАШЕ-B', '3');
    const theirs = lines('1', 'ИХ-A', '2', 'ИХ-B', '3');
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.conflicts).toBe(2);
    expect(kinds(result.regions)).toEqual(['stable', 'conflict', 'stable', 'conflict', 'stable']);
  });

  it('чистые правки поодаль от спора сливаются, спор остаётся спором', () => {
    const base = lines('шапка', '-', 'a', '-', 'подвал');
    const ours = lines('ШАПКА', '-', 'наше', '-', 'подвал');
    const theirs = lines('шапка', '-', 'их', '-', 'ПОДВАЛ');
    const result = mergeThreeWay(base, ours, theirs);
    expect(result.conflicts).toBe(1);
    const merged = result.text.split('\n');
    expect(merged[0]).toBe('ШАПКА');
    expect(merged.at(-1)).toBe('ПОДВАЛ');
  });

  it('правка ВПЛОТНУЮ к спорному участку втягивается в конфликт', () => {
    // Своя правка соседней строки от чужой неотличима, пока участок не разделён хотя бы
    // одной общей строкой: границу конфликта задаёт основание, а не намерение автора.
    // Расширять конфликт безопасно (человек увидит больше, чем спорил), сужать — нет.
    const result = mergeThreeWay(
      lines('шапка', 'a', 'подвал'),
      lines('ШАПКА', 'наше', 'подвал'),
      lines('шапка', 'их', 'ПОДВАЛ')
    );
    expect(result.conflicts).toBe(1);
    expect(kinds(result.regions)).toEqual(['conflict']);
    const conflict = result.regions[0];
    expect(conflict.ours).toEqual(['ШАПКА', 'наше', 'подвал']);
    expect(conflict.theirs).toEqual(['шапка', 'их', 'ПОДВАЛ']);
  });
});

describe('слияние: пустые стороны', () => {
  it('все три пусты', () => {
    const result = mergeThreeWay('', '', '');
    expect(result.clean).toBe(true);
    expect(result.text).toBe('');
  });

  it('пустое основание, дописали только мы', () => {
    const result = mergeThreeWay('', 'наше', '');
    expect(result.clean).toBe(true);
    expect(result.text).toBe('наше');
  });

  it('пустое основание, обе стороны дописали разное — конфликт', () => {
    const result = mergeThreeWay('', 'наше', 'их');
    expect(result.clean).toBe(false);
    expect(result.conflicts).toBe(1);
  });

  it('мы стёрли файл целиком, источник его не трогал', () => {
    const result = mergeThreeWay(lines('a', 'b'), '', lines('a', 'b'));
    expect(result.clean).toBe(true);
    expect(result.text).toBe('');
  });

  it('мы стёрли файл целиком, источник его правил — конфликт', () => {
    const result = mergeThreeWay(lines('a', 'b'), '', lines('a', 'B'));
    expect(result.clean).toBe(false);
    expect(result.conflicts).toBe(1);
  });

  it('обе стороны стёрли файл целиком — согласие, а не конфликт', () => {
    const result = mergeThreeWay(lines('a', 'b'), '', '');
    expect(result.clean).toBe(true);
    expect(result.text).toBe('');
  });
});

describe('слияние: текст сохраняется как есть', () => {
  it('завершающий перевод строки не теряется и не появляется', () => {
    const result = mergeThreeWay('a\nb\n', 'a\nB\n', 'a\nb\n');
    expect(result.text).toBe('a\nB\n');
    expect(mergeThreeWay('a\nb', 'a\nB', 'a\nb').text).toBe('a\nB');
  });

  it('концы строк CRLF не переписываются', () => {
    const result = mergeThreeWay('a\r\nb\r\n', 'a\r\nB\r\n', 'a\r\nb\r\n');
    expect(result.text).toBe('a\r\nB\r\n');
  });

  it('строка, отличающаяся только концом строки, считается изменённой', () => {
    const result = mergeThreeWay('a\nb', 'a\r\nb', 'a\nb');
    expect(result.text).toBe('a\r\nb');
  });
});

describe('разметка конфликта', () => {
  it('подписи сторон подставляются', () => {
    const result = mergeThreeWay('b', 'наше', 'их', {
      markers: { ours: 'OURS', base: 'BASE', theirs: 'THEIRS' },
    });
    expect(result.text).toBe(
      lines('<<<<<<< OURS', 'наше', '||||||| BASE', 'b', '=======', 'их', '>>>>>>> THEIRS')
    );
  });

  it('основание можно не показывать — для инструментов, знающих две стороны', () => {
    const result = mergeThreeWay('b', 'наше', 'их', { includeBase: false });
    expect(result.text).toBe(
      lines(
        `<<<<<<< ${DEFAULT_MARKERS.ours}`,
        'наше',
        '=======',
        'их',
        `>>>>>>> ${DEFAULT_MARKERS.theirs}`
      )
    );
  });

  it('маркеры находятся по началу строки, а не по вхождению', () => {
    expect(hasConflictMarkers(lines('a', '<<<<<<< наше', 'b'))).toBe(true);
    expect(hasConflictMarkers(lines('a', '=======', 'b'))).toBe(true);
    expect(hasConflictMarkers(lines('a', '||||||| основание'))).toBe(true);
    expect(hasConflictMarkers(lines('a', '>>>>>>> источник'))).toBe(true);
    expect(hasConflictMarkers(lines('a', 'см. <<<<<<< в разметке', 'b'))).toBe(false);
    expect(hasConflictMarkers('')).toBe(false);
  });

  it('текст с разметкой сам не проходит проверку на разметку', () => {
    const result = mergeThreeWay('b', 'наше', 'их');
    expect(hasConflictMarkers(result.text)).toBe(true);
  });
});

describe('бюджет', () => {
  /** Строки заведомо различны у всех трёх сторон: общие края отсечься не должны. */
  const huge = (prefix: string, count: number): string =>
    Array.from({ length: count }, (_, i) => `${prefix}-${i}`).join('\n');

  it('слишком крупные стороны дают один конфликт на весь файл, а не догадку', () => {
    const size = Math.ceil(Math.sqrt(LCS_CELL_BUDGET)) + 10;
    const result = mergeThreeWay(huge('base', size), huge('ours', size), huge('theirs', size));
    expect(result.overBudget).toBe(true);
    expect(result.clean).toBe(false);
    expect(result.conflicts).toBe(1);
    expect(result.regions).toHaveLength(1);
    expect(hasConflictMarkers(result.text)).toBe(true);
  });

  it('за бюджетом diff тоже не выдумывает общности', () => {
    const size = Math.ceil(Math.sqrt(LCS_CELL_BUDGET)) + 10;
    const ops = diffLines(huge('a', size), huge('b', size));
    expect(ops.every((op) => op.type !== 'same')).toBe(true);
    expect(diffStat(ops)).toEqual({ added: size, removed: size });
  });

  it('общие края отсекаются до таблицы: длинный неизменённый файл сливается мгновенно', () => {
    const body = huge('line', 20_000);
    const result = mergeThreeWay(body, `${body}\nнаше`, body);
    expect(result.overBudget).toBe(false);
    expect(result.clean).toBe(true);
    expect(result.text).toBe(`${body}\nнаше`);
  });
});
