/**
 * Тесты состояния вида канваса.
 *
 * Проверяется ровно то, ради чего модуль устроен именно так: снимок хранится ЗАРАНЕЕ (иначе
 * `capture` спрашивал бы у размонтированного тела) и проверяется на чтении (иначе чужое
 * значение из хранилища роняло бы открытие файла).
 *
 * @module plugins/editor-schema/session/view-state.test
 */

import { describe, expect, it } from 'vitest';
import { createCollapseRegistry, readCollapsedState } from './view-state';

describe('readCollapsedState', () => {
  it('принимает список адресов', () => {
    expect(readCollapsedState(['abcd1234', 'zzzz0000'])).toEqual(['abcd1234', 'zzzz0000']);
  });

  it('пустой список — законное состояние «всё развёрнуто», а не отсутствие снимка', () => {
    expect(readCollapsedState([])).toEqual([]);
  });

  it('не список — снимка нет: дерево откроется развёрнутым, а не упадёт', () => {
    expect(readCollapsedState(undefined)).toBeNull();
    expect(readCollapsedState(null)).toBeNull();
    expect(readCollapsedState('abcd1234')).toBeNull();
    expect(readCollapsedState({ collapsed: ['abcd1234'] })).toBeNull();
  });

  it('чужие элементы отбрасываются поштучно: одна кривая строка не теряет остальные', () => {
    expect(readCollapsedState(['abcd1234', 'СЛИШКОМ_ДЛИННО', 42, null, 'zzzz0000'])).toEqual([
      'abcd1234',
      'zzzz0000',
    ]);
  });
});

describe('createCollapseRegistry', () => {
  it('отдаёт последний записанный снимок', () => {
    const registry = createCollapseRegistry();
    registry.record('fs:a.json', new Set(['abcd1234']));
    registry.record('fs:a.json', new Set(['abcd1234', 'zzzz0000']));
    expect(registry.peek('fs:a.json')).toEqual(['abcd1234', 'zzzz0000']);
  });

  it('пустой набор ЗАПИСЫВАЕТСЯ, а не считается отсутствием снимка', () => {
    const registry = createCollapseRegistry();
    registry.record('fs:a.json', new Set(['abcd1234']));
    registry.record('fs:a.json', new Set());
    // Иначе «развернул всё» возвращало бы позапрошлое состояние вида.
    expect(registry.peek('fs:a.json')).toEqual([]);
  });

  it('снимки документов не путаются между собой', () => {
    const registry = createCollapseRegistry();
    registry.record('fs:a.json', new Set(['aaaa1111']));
    registry.record('fs:b.json', new Set(['bbbb2222']));
    expect(registry.peek('fs:a.json')).toEqual(['aaaa1111']);
    expect(registry.peek('fs:b.json')).toEqual(['bbbb2222']);
  });

  it('незнакомый документ — `null`', () => {
    expect(createCollapseRegistry().peek('fs:нет.json')).toBeNull();
  });

  it('забытый снимок не возвращается', () => {
    const registry = createCollapseRegistry();
    registry.record('fs:a.json', new Set(['abcd1234']));
    registry.forget('fs:a.json');
    expect(registry.peek('fs:a.json')).toBeNull();
  });

  it('снимок отвязан от переданного набора: правка набора его не меняет', () => {
    const registry = createCollapseRegistry();
    const live = new Set(['abcd1234']);
    registry.record('fs:a.json', live);
    live.add('zzzz0000');
    expect(registry.peek('fs:a.json')).toEqual(['abcd1234']);
  });
});
