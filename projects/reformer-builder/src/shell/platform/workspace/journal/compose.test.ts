/**
 * Тесты композиции патчей.
 *
 * Главная проверка — не список случаев, а тождество: два пакета подряд обязаны давать то же,
 * что их композиция. Оно перебирается на случайных текстах и правках, потому что именно
 * на стыках (правка внутри вставки, удаление через границу, дописывание в конец) руками
 * придумываются не те случаи, которые ломаются.
 *
 * @module shell/platform/workspace/journal/compose.test
 */

import { describe, expect, it } from 'vitest';

import { applyTextEdits, type TextEdit } from '../model/history';
import { composeTextEdits } from './compose';

/** Проверка тождества на конкретном тексте. */
function sameAsSequential(text: string, first: readonly TextEdit[], second: readonly TextEdit[]) {
  const sequential = applyTextEdits(applyTextEdits(text, first), second);
  const composed = applyTextEdits(text, composeTextEdits(first, second));
  return { sequential, composed };
}

describe('композиция двух пакетов', () => {
  it('склеивает набор текста в одну вставку', () => {
    const first: TextEdit[] = [{ offset: 5, removed: '', inserted: 'a' }];
    const second: TextEdit[] = [{ offset: 6, removed: '', inserted: 'b' }];

    expect(composeTextEdits(first, second)).toEqual([{ offset: 5, removed: '', inserted: 'ab' }]);
  });

  it('вставка перед вставкой не переворачивает порядок символов', () => {
    const first: TextEdit[] = [{ offset: 5, removed: '', inserted: 'a' }];
    const second: TextEdit[] = [{ offset: 5, removed: '', inserted: 'b' }];

    expect(composeTextEdits(first, second)).toEqual([{ offset: 5, removed: '', inserted: 'ba' }]);
  });

  it('стирание только что набранного схлопывается в пустоту', () => {
    const first: TextEdit[] = [{ offset: 3, removed: '', inserted: 'x' }];
    const second: TextEdit[] = [{ offset: 3, removed: 'x', inserted: '' }];

    expect(composeTextEdits(first, second)).toEqual([]);
  });

  it('удаление через границу вставки забирает и символы основания', () => {
    // «abcdef» → пакет 1 ставит «X» после «c» и убирает «d» → «abcXef»
    const first: TextEdit[] = [{ offset: 3, removed: 'd', inserted: 'X' }];
    // «abcXef» → пакет 2 убирает «Xe» и ставит «Y» → «abcYf»
    const second: TextEdit[] = [{ offset: 3, removed: 'Xe', inserted: 'Y' }];

    // Символ «d» второму пакету не виден вовсе, но в координатах основания он внутри
    // удаляемого куска — без него композиция вырезала бы из текста разрыв.
    expect(composeTextEdits(first, second)).toEqual([{ offset: 3, removed: 'de', inserted: 'Y' }]);
    expect(sameAsSequential('abcdef', first, second)).toEqual({
      sequential: 'abcYf',
      composed: 'abcYf',
    });
  });

  it('далеко разнесённые правки остаются двумя, а не сливаются через нетронутый текст', () => {
    const first: TextEdit[] = [{ offset: 1, removed: '', inserted: 'A' }];
    const second: TextEdit[] = [{ offset: 8, removed: '', inserted: 'B' }];

    // Символы между правками нам неизвестны (их нет ни в одном пакете) — значит, попасть
    // в `removed` они не могут, и склеить две правки в одну нельзя.
    expect(composeTextEdits(first, second)).toEqual([
      { offset: 1, removed: '', inserted: 'A' },
      { offset: 7, removed: '', inserted: 'B' },
    ]);
    expect(sameAsSequential('0123456789', first, second)).toEqual({
      sequential: '0A123456B789',
      composed: '0A123456B789',
    });
  });

  it('дописывание в конец текста', () => {
    const first: TextEdit[] = [{ offset: 3, removed: '', inserted: 'd' }];
    const second: TextEdit[] = [{ offset: 4, removed: '', inserted: 'e' }];

    expect(sameAsSequential('abc', first, second)).toEqual({
      sequential: 'abcde',
      composed: 'abcde',
    });
  });

  it('пустой пакет с любой стороны ничего не меняет', () => {
    const edits: TextEdit[] = [{ offset: 1, removed: 'b', inserted: 'B' }];

    expect(composeTextEdits(edits, [])).toEqual(edits);
    expect(composeTextEdits([], edits)).toEqual(edits);
  });

  it('отказывает, если второй пакет не ложится на полученный текст', () => {
    const first: TextEdit[] = [{ offset: 0, removed: '', inserted: 'abcd' }];
    // Две правки, удаляющие одно и то же: такой пакет и применить было бы нельзя
    // (`applyTextEdits` назвал бы их пересекающимися).
    const second: TextEdit[] = [
      { offset: 0, removed: 'abcd', inserted: '' },
      { offset: 0, removed: 'abcd', inserted: '' },
    ];

    // Молча вернуть из такого пакета правдоподобный мусор хуже, чем отказать.
    expect(() => composeTextEdits(first, second)).toThrow(/не ложится/);
  });
});

describe('кодовые единицы UTF-16', () => {
  it('правка после эмодзи стоит там, где её ждёт JavaScript, а не счёт по символам', () => {
    const text = 'a😀bcd';
    // «😀» занимает ДВЕ кодовые единицы: «b» стоит на смещении 3, «c» — на 4, а не на 2 и 3.
    const first: TextEdit[] = [{ offset: 4, removed: 'c', inserted: 'C' }];
    const second: TextEdit[] = [{ offset: 1, removed: '😀', inserted: '🙂' }];

    const composed = composeTextEdits(first, second);
    expect(composed).toEqual([
      { offset: 1, removed: '😀', inserted: '🙂' },
      { offset: 4, removed: 'c', inserted: 'C' },
    ]);
    expect(applyTextEdits(text, composed)).toBe('a🙂bCd');
    expect(sameAsSequential(text, first, second)).toEqual({
      sequential: 'a🙂bCd',
      composed: 'a🙂bCd',
    });
  });

  it('соседние в основании правки сливаются в одну — и это по-прежнему тот же текст', () => {
    const text = 'a😀b';
    const first: TextEdit[] = [{ offset: 3, removed: 'b', inserted: 'B' }];
    const second: TextEdit[] = [{ offset: 1, removed: '😀', inserted: '🙂' }];

    // Куски основания [1, 3) и [3, 4) стыкуются, нетронутого текста между ними нет —
    // значит, склейка в одну правку законна и ничего не додумывает.
    expect(composeTextEdits(first, second)).toEqual([
      { offset: 1, removed: '😀b', inserted: '🙂B' },
    ]);
    expect(sameAsSequential(text, first, second)).toEqual({
      sequential: 'a🙂B',
      composed: 'a🙂B',
    });
  });

  it('набор эмодзи по одной паре схлопывается в одну вставку', () => {
    const first: TextEdit[] = [{ offset: 1, removed: '', inserted: '😀' }];
    // Следующая вставка идёт на смещении 3 = 1 + 2 кодовые единицы эмодзи.
    const second: TextEdit[] = [{ offset: 3, removed: '', inserted: '🙂' }];

    expect(composeTextEdits(first, second)).toEqual([{ offset: 1, removed: '', inserted: '😀🙂' }]);
    expect(sameAsSequential('ab', first, second)).toEqual({
      sequential: 'a😀🙂b',
      composed: 'a😀🙂b',
    });
  });
});

describe('тождество на переборе', () => {
  /** Свой генератор: тест обязан падать одинаково у всех, а `Math.random` этого не даёт. */
  function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  const alphabet = [...'abcde', '😀', '🙂'];

  function randomText(rnd: () => number, length: number): string {
    let text = '';
    for (let i = 0; i < length; i += 1) text += alphabet[Math.floor(rnd() * alphabet.length)];
    return text;
  }

  /** Непересекающийся пакет над данным текстом — такой же, какой отдаёт редактор. */
  function randomBatch(text: string, rnd: () => number): TextEdit[] {
    const edits: TextEdit[] = [];
    let position = 0;
    const count = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < count; i += 1) {
      if (position > text.length) break;
      const offset = position + Math.floor(rnd() * (text.length - position + 1));
      const removed = text.slice(offset, offset + Math.floor(rnd() * 3));
      const inserted = randomText(rnd, Math.floor(rnd() * 3));
      if (removed === '' && inserted === '') continue;
      edits.push({ offset, removed, inserted });
      position = offset + removed.length + 1;
    }
    return edits;
  }

  it('композиция даёт тот же текст, что два пакета подряд', () => {
    const rnd = makeRandom(20260829);
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const text = randomText(rnd, Math.floor(rnd() * 12));
      const first = randomBatch(text, rnd);
      const intermediate = applyTextEdits(text, first);
      const second = randomBatch(intermediate, rnd);

      const { sequential, composed } = sameAsSequential(text, first, second);
      expect(
        composed,
        `текст «${text}», пакеты ${JSON.stringify(first)} и ${JSON.stringify(second)}`
      ).toBe(sequential);
    }
  });
});
