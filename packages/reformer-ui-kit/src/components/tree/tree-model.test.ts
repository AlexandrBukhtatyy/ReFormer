import { describe, expect, it } from 'vitest';

import {
  actionTargets,
  createTreeState,
  expandNode,
  filterTree,
  flattenTree,
  invalidateLevel,
  isBranch,
  levelStatus,
  rangeIds,
  setChildren,
  setLevelStatus,
  type TreeNode,
  type TreeRow,
} from './variants/base/tree-model';
import { rowRange } from './variants/base/use-virtual-rows';

/**
 * Правила дерева проверяются БЕЗ единого DOM-узла: порядок строк, видимость, поиск и цель
 * действия — это арифметика над состоянием, а не отрисовка. Всё, что без браузера не проверить
 * (фокус, прокрутка, содержимое поповера), закрывается e2e.
 */

const NODES: readonly TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    kind: 'branch',
    children: [
      {
        id: 'src/components',
        label: 'components',
        kind: 'branch',
        children: [
          { id: 'src/components/Button.tsx', label: 'Button.tsx' },
          { id: 'src/components/Input.tsx', label: 'Input.tsx' },
        ],
      },
      { id: 'src/index.ts', label: 'index.ts' },
    ],
  },
  { id: 'README.md', label: 'README.md' },
];

const NONE: ReadonlySet<string> = new Set();

function flatten(expanded: string[] = [], selectedId: string | null = null): readonly TreeRow[] {
  let state = createTreeState();
  for (const id of expanded) state = expandNode(state, id);
  return flattenTree({ state, roots: NODES, selectedId, checked: NONE });
}

describe('вид узла', () => {
  it('ветка объявляется полем kind, а не наличием детей', () => {
    // Ленивая ветка объявлена веткой, хотя детей у неё ещё нет.
    expect(isBranch({ id: 'a', label: 'a', kind: 'branch' })).toBe(true);
    expect(isBranch({ id: 'b', label: 'b', kind: 'leaf', children: [] })).toBe(false);
  });

  it('без kind вид выводится из наличия поля children', () => {
    expect(isBranch({ id: 'a', label: 'a', children: [] })).toBe(true);
    expect(isBranch({ id: 'b', label: 'b' })).toBe(false);
  });
});

describe('видимый ряд строк', () => {
  it('свёрнутое дерево показывает только верхний уровень', () => {
    expect(flatten().map((r) => r.node.id)).toEqual(['src', 'README.md']);
  });

  it('дети раскрытой ветки идут сразу за ней и глубже на уровень', () => {
    const rows = flatten(['src']);
    expect(rows.map((r) => r.node.id)).toEqual([
      'src',
      'src/components',
      'src/index.ts',
      'README.md',
    ]);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 0]);
  });

  it('раскрытие вложенной ветки не трогает порядок соседей', () => {
    expect(flatten(['src', 'src/components']).map((r) => r.node.id)).toEqual([
      'src',
      'src/components',
      'src/components/Button.tsx',
      'src/components/Input.tsx',
      'src/index.ts',
      'README.md',
    ]);
  });

  it('раскрытым считается только ветка: у листа expanded всегда false', () => {
    const rows = flatten(['src', 'README.md']);
    expect(rows.find((r) => r.node.id === 'README.md')?.expanded).toBe(false);
  });

  it('родитель проставлен для стрелки «влево»', () => {
    const rows = flatten(['src']);
    expect(rows.find((r) => r.node.id === 'src/index.ts')?.parentId).toBe('src');
    expect(rows.find((r) => r.node.id === 'src')?.parentId).toBeNull();
  });

  it('нечитанный уровень строк не даёт — их ещё нет, а не «их ноль»', () => {
    const lazy: TreeNode[] = [{ id: 'a', label: 'a', kind: 'branch' }];
    const state = expandNode(createTreeState(), 'a');
    const rows = flattenTree({ state, roots: lazy, selectedId: null, checked: NONE });
    expect(rows.map((r) => r.node.id)).toEqual(['a']);
  });

  it('запрет выбора складывается из данных узла и предиката', () => {
    const nodes: TreeNode[] = [
      { id: 'a', label: 'a', disabled: true },
      { id: 'b', label: 'b' },
      { id: 'c', label: 'c' },
    ];
    const rows = flattenTree({
      state: createTreeState(),
      roots: nodes,
      selectedId: null,
      checked: NONE,
      isDisabled: (node) => node.id === 'c',
    });
    expect(rows.map((r) => r.disabled)).toEqual([true, false, true]);
  });

  it('состояние чтения складывается из уровня и объявления узла', () => {
    const nodes: TreeNode[] = [
      { id: 'a', label: 'a', kind: 'branch' },
      { id: 'b', label: 'b', kind: 'branch', loading: true },
    ];
    const state = setLevelStatus(createTreeState(), 'a', 'loading');
    const rows = flattenTree({ state, roots: nodes, selectedId: null, checked: NONE });
    expect(rows.map((r) => r.loading)).toEqual([true, true]);
  });
});

describe('прочитанные уровни', () => {
  it('неизвестная ветка — unloaded, а не отсутствие ответа', () => {
    expect(levelStatus(createTreeState(), 'src')).toBe('unloaded');
  });

  it('прочитанные дети вытесняют объявленные в узле — иначе refresh ничего не менял бы', () => {
    const state = setChildren(createTreeState(), 'src', [{ id: 'src/new.ts', label: 'new.ts' }]);
    const rows = flattenTree({
      state: expandNode(state, 'src'),
      roots: NODES,
      selectedId: null,
      checked: NONE,
    });
    expect(rows.map((r) => r.node.id)).toEqual(['src', 'src/new.ts', 'README.md']);
  });

  it('invalidateLevel забывает уровень целиком — и детей, и его состояние', () => {
    const state = setChildren(createTreeState(), 'src', []);
    const next = invalidateLevel(state, 'src');
    expect(levelStatus(next, 'src')).toBe('unloaded');
    expect(next.children.has('src')).toBe(false);
  });

  it('свёрнутая ветка прочитанных детей НЕ теряет', () => {
    const state = setChildren(createTreeState(), 'src', [{ id: 'src/a.ts', label: 'a.ts' }]);
    expect(levelStatus(state, 'src')).toBe('loaded');
  });
});

describe('поиск', () => {
  it('совпавший лист остаётся видимым вместе со всем путём до него', () => {
    const result = filterTree(createTreeState(), NODES, 'button');
    expect([...result.visible].sort()).toEqual(
      ['src', 'src/components', 'src/components/Button.tsx'].sort()
    );
  });

  it('путь до совпадения раскрывается, а сам совпавший лист — нет', () => {
    const result = filterTree(createTreeState(), NODES, 'button');
    expect([...result.forcedExpanded].sort()).toEqual(['src', 'src/components'].sort());
  });

  it('совпавшая ветка показывает своё поддерево целиком', () => {
    const result = filterTree(createTreeState(), NODES, 'components');
    expect(result.visible.has('src/components/Input.tsx')).toBe(true);
  });

  it('пустой запрос фильтром не считается', () => {
    const result = filterTree(createTreeState(), NODES, '   ');
    expect(result.matched).toBe(true);
    expect(result.visible.size).toBe(0);
  });

  it('регистр не различается', () => {
    expect(filterTree(createTreeState(), NODES, 'BUTTON').visible.size).toBeGreaterThan(0);
  });

  it('нечитанная ветка остаётся видимой: её содержимое ещё не за что судить', () => {
    const lazy: TreeNode[] = [{ id: 'dir', label: 'dir', kind: 'branch' }];
    const result = filterTree(createTreeState(), lazy, 'zzz');
    expect(result.visible.has('dir')).toBe(true);
  });

  it('ветка, совпавшая сама, всё равно раскрывается ради совпадений внутри', () => {
    // «components» совпадает с «ts» собственным хвостом. Ранний выход на этом совпадении
    // оставлял каталог свёрнутым, и три совпавших файла внутри исчезали из вида.
    const result = filterTree(createTreeState(), NODES, 'ts');
    expect(result.forcedExpanded.has('src/components')).toBe(true);
    expect(result.visible.has('src/components/Button.tsx')).toBe(true);
  });

  it('промах не оставляет ничего видимого', () => {
    const result = filterTree(createTreeState(), NODES, 'нетакогофайла');
    expect(result.matched).toBe(false);
    expect(result.visible.size).toBe(0);
  });

  it('фильтр применяется к ряду строк: невидимые узлы в него не попадают', () => {
    const filter = filterTree(createTreeState(), NODES, 'button');
    const rows = flattenTree({
      state: createTreeState(),
      roots: NODES,
      selectedId: null,
      checked: NONE,
      forcedExpanded: filter.forcedExpanded,
      visible: filter.visible,
    });
    expect(rows.map((r) => r.node.id)).toEqual([
      'src',
      'src/components',
      'src/components/Button.tsx',
    ]);
  });
});

describe('диапазон и цель действия', () => {
  const rows = flatten(['src']);

  it('диапазон считается по видимым строкам и включает обе границы', () => {
    expect(rangeIds(rows, 'src/components', 'README.md')).toEqual([
      'src/components',
      'src/index.ts',
      'README.md',
    ]);
  });

  it('диапазон снизу вверх даёт тот же порядок строк', () => {
    expect(rangeIds(rows, 'README.md', 'src/index.ts')).toEqual(['src/index.ts', 'README.md']);
  });

  it('неизвестная граница даёт пустой диапазон, а не «выделить всё»', () => {
    expect(rangeIds(rows, 'src', 'нет-такой-строки')).toEqual([]);
  });

  it('выделение вне набора — цель ровно одна строка', () => {
    const withChecked = flattenTree({
      state: expandNode(createTreeState(), 'src'),
      roots: NODES,
      selectedId: 'src/index.ts',
      checked: new Set(['README.md']),
    });
    expect(actionTargets(withChecked).map((n) => n.id)).toEqual(['src/index.ts']);
  });

  it('выделение внутри набора — цель весь набор, в порядке строк', () => {
    const withChecked = flattenTree({
      state: expandNode(createTreeState(), 'src'),
      roots: NODES,
      selectedId: 'README.md',
      checked: new Set(['README.md', 'src/components']),
    });
    expect(actionTargets(withChecked).map((n) => n.id)).toEqual(['src/components', 'README.md']);
  });

  it('без выделения и без набора цели нет', () => {
    expect(actionTargets(flatten())).toEqual([]);
  });
});

describe('окно видимых строк', () => {
  const ROW = 24;

  it('в начале списка показывает вьюпорт с запасом снизу', () => {
    // 240 px вьюпорта — это 10 строк, плюс срезанная нижней границей, плюс запас.
    expect(rowRange(0, 240, ROW, 1000, 8)).toEqual({ start: 0, end: 19 });
  });

  it('прокрутка сдвигает окно и оставляет запас сверху', () => {
    expect(rowRange(ROW * 100, 240, ROW, 1000, 8)).toEqual({ start: 92, end: 119 });
  });

  it('конец списка не выезжает за его границы', () => {
    expect(rowRange(ROW * 995, 240, ROW, 1000, 8)).toEqual({ start: 987, end: 1000 });
  });

  it('пустой список окна не даёт', () => {
    expect(rowRange(0, 240, ROW, 0, 8)).toEqual({ start: 0, end: 0 });
  });

  it('неизмеренный вьюпорт показывает хотя бы одну строку, а не пустоту', () => {
    // Первый кадр: высота ещё не прочитана. Пустое окно означало бы вспышку пустого дерева.
    expect(rowRange(0, 0, ROW, 100, 0).end).toBe(1);
  });

  it('нулевая высота строки не делит на ноль', () => {
    expect(rowRange(100, 240, 0, 100, 8)).toEqual({ start: 0, end: 0 });
  });

  it('отрицательная прокрутка (инерция у края) считается нулевой', () => {
    expect(rowRange(-120, 240, ROW, 100, 0)).toEqual({ start: 0, end: 11 });
  });
});
