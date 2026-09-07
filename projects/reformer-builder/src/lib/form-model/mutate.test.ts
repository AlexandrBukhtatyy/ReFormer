import { describe, expect, it } from 'vitest';
import type { JsonNode, JsonFormSchema } from '@reformer/renderer-json';
import {
  setComponentProp,
  setNodeKey,
  switchVariant,
  insertNode,
  appendNode,
  removeNode,
  moveNode,
  duplicateNode,
  wrapInHtmlDiv,
  wrapInRow,
  wrapPairInRow,
  wrapInColumn,
  wrapPairInColumn,
  unwrapSingleChild,
  flipDirection,
  flipWrapperPair,
  reorderBlock,
  removeBlock,
  removeIndices,
  groupBlock,
  ungroupNode,
  setTextChild,
  textChildIndex,
} from './mutate';
import { getAt, removeAt } from './paths';
import { sampleSchema, P } from './__fixtures__/sample-schema';

const field = (model: string): JsonNode => ({
  value: `$model(${model})` as `$model(${string})`,
  component: '$component(Input)',
  componentProps: { label: model },
});

describe('setComponentProp', () => {
  it('правит проп, newPath = путь узла, оригинал цел', () => {
    const s = sampleSchema();
    const { schema, newPath } = setComponentProp(s, P.step0field0, 'label', 'Тип');
    expect(getAt(schema, [...P.step0field0, 'componentProps', 'label'])).toBe('Тип');
    expect(newPath).toEqual([...P.step0field0]);
    expect(getAt(s, [...P.step0field0, 'componentProps', 'label'])).toBe('Тип кредита');
  });

  it('undefined удаляет проп', () => {
    const s = sampleSchema();
    const { schema } = setComponentProp(s, P.step0field1, 'type', undefined);
    expect(getAt(schema, [...P.step0field1, 'componentProps', 'type'])).toBeUndefined();
  });
});

describe('switchVariant', () => {
  it('меняет компонент и прунит несовместимые пропсы, общие — сохраняет', () => {
    const s = sampleSchema();
    // step0field1: Input { label:'Сумма', type:'number' }. Цель знает label, но не type.
    const { schema, newPath } = switchVariant(
      s,
      P.step0field1,
      'InputPassword',
      new Set(['label', 'showToggle', 'className'])
    );
    expect(getAt(schema, [...P.step0field1, 'component'])).toBe('$component(InputPassword)');
    expect(getAt(schema, [...P.step0field1, 'componentProps', 'label'])).toBe('Сумма');
    expect(getAt(schema, [...P.step0field1, 'componentProps', 'type'])).toBeUndefined();
    expect(newPath).toEqual([...P.step0field1]);
    // оригинал не тронут
    expect(getAt(s, [...P.step0field1, 'component'])).toBe('$component(Input)');
    expect(getAt(s, [...P.step0field1, 'componentProps', 'type'])).toBe('number');
  });

  it('узел без componentProps — только меняет компонент', () => {
    const s = removeAt(sampleSchema(), [...P.step0field1, 'componentProps']);
    const { schema } = switchVariant(s, P.step0field1, 'InputPassword', new Set(['label']));
    expect(getAt(schema, [...P.step0field1, 'component'])).toBe('$component(InputPassword)');
    expect(getAt(schema, [...P.step0field1, 'componentProps'])).toBeUndefined();
  });
});

describe('setNodeKey', () => {
  it('ставит selector', () => {
    const s = sampleSchema();
    const { schema } = setNodeKey(s, P.step0field0, 'selector', 'loan-type');
    expect(getAt(schema, [...P.step0field0, 'selector'])).toBe('loan-type');
  });
});

describe('insertNode / appendNode', () => {
  it('вставка в children на индекс', () => {
    const s = sampleSchema();
    const { schema, newPath } = insertNode(s, P.step0children, 1, field('mid'));
    const children = getAt(schema, P.step0children) as JsonNode[];
    expect(children).toHaveLength(3);
    expect((children[1] as { value?: string }).value).toBe('$model(mid)');
    expect(newPath).toEqual([...P.step0children, 1]);
  });

  it('индекс за пределами → в конец', () => {
    const s = sampleSchema();
    const { newPath } = insertNode(s, P.step0children, 99, field('last'));
    expect(newPath).toEqual([...P.step0children, 2]);
  });

  it('appendNode добавляет в конец', () => {
    const s = sampleSchema();
    const { schema, newPath } = appendNode(s, P.step0children, field('tail'));
    expect(getAt(schema, P.step0children) as JsonNode[]).toHaveLength(3);
    expect(newPath).toEqual([...P.step0children, 2]);
  });

  it('создаёт слот children, если его не было', () => {
    const s = sampleSchema();
    // у array-узла нет children — вставка создаст массив
    const slot = [...P.array, 'children'];
    const { schema } = insertNode(s, slot, 0, field('x'));
    expect(getAt(schema, slot) as JsonNode[]).toHaveLength(1);
  });
});

describe('removeNode', () => {
  it('удаляет узел, выделение → родитель', () => {
    const s = sampleSchema();
    const { schema, newPath } = removeNode(s, P.step0field0);
    expect(getAt(schema, P.step0children) as JsonNode[]).toHaveLength(1);
    expect(newPath).toEqual([...P.step0]);
  });
});

describe('moveNode', () => {
  it('перемещение внутри одного слота в конец (компенсация индекса)', () => {
    const s = sampleSchema();
    // переместить field0 на позицию 2 (в конец из двух) → должен встать последним
    const { schema, newPath } = moveNode(s, P.step0field0, P.step0children, 2);
    const children = getAt(schema, P.step0children) as JsonNode[];
    expect(children).toHaveLength(2);
    expect((children[0] as { value?: string }).value).toBe('$model(loanAmount)');
    expect((children[1] as { value?: string }).value).toBe('$model(loanType)');
    expect(newPath).toEqual([...P.step0children, 1]);
  });

  it('перемещение между слотами разных шагов', () => {
    const s = sampleSchema();
    const { schema, newPath } = moveNode(s, P.step0field1, P.step1children, 0);
    expect(getAt(schema, P.step0children) as JsonNode[]).toHaveLength(1);
    const step1 = getAt(schema, P.step1children) as JsonNode[];
    expect(step1).toHaveLength(2);
    expect((step1[0] as { value?: string }).value).toBe('$model(loanAmount)');
    expect(newPath).toEqual([...P.step1children, 0]);
  });
});

describe('duplicateNode', () => {
  it('вставляет глубокую копию сразу после оригинала', () => {
    const s = sampleSchema();
    const { schema, newPath } = duplicateNode(s, P.step0field0);
    const children = getAt(schema, P.step0children) as JsonNode[];
    expect(children).toHaveLength(3);
    expect((children[1] as { value?: string }).value).toBe('$model(loanType)');
    expect(children[1]).not.toBe(children[0]); // именно копия
    expect(newPath).toEqual([...P.step0children, 1]);
  });
});

describe('wrapInHtmlDiv', () => {
  it('оборачивает узел в $html(div) flex-группу, newPath ведёт внутрь', () => {
    const s = sampleSchema();
    const { schema, newPath } = wrapInHtmlDiv(s, P.step0field0);
    const group = getAt(schema, P.step0field0) as {
      component: string;
      componentProps: { className: string };
      children: Array<{ value?: string }>;
    };
    expect(group.component).toBe('$html(div)');
    expect(group.componentProps.className).toBe('flex gap-4');
    expect(group.children).toHaveLength(1);
    expect(group.children[0].value).toBe('$model(loanType)');
    expect(newPath).toEqual([...P.step0field0, 'children', 0]);
  });
});

describe('wrapInRow / wrapPairInRow / unwrapSingleChild (горизонтальный ряд)', () => {
  it('wrapInRow (new, after): цель → $html(div)-ряд [цель, новый], newPath на новый', () => {
    const s = sampleSchema();
    const { schema, newPath } = wrapInRow(s, P.step0field0, field('extra'), 'after');
    const row = getAt(schema, P.step0field0) as {
      component: string;
      componentProps: { className: string };
      children: Array<{ value?: string }>;
    };
    expect(row.component).toBe('$html(div)');
    expect(row.componentProps.className).toBe('flex gap-4');
    expect(row.children.map((c) => c.value)).toEqual(['$model(loanType)', '$model(extra)']);
    expect(newPath).toEqual([...P.step0field0, 'children', 1]);
    // соседний слот не тронут: field0 заменён рядом, field1 на месте → длина 2
    expect(getAt(schema, P.step0children) as JsonNode[]).toHaveLength(2);
  });

  it('wrapInRow (new, before): новый узел первой колонкой', () => {
    const s = sampleSchema();
    const { schema, newPath } = wrapInRow(s, P.step0field0, field('extra'), 'before');
    const row = getAt(schema, P.step0field0) as { children: Array<{ value?: string }> };
    expect(row.children.map((c) => c.value)).toEqual(['$model(extra)', '$model(loanType)']);
    expect(newPath).toEqual([...P.step0field0, 'children', 0]);
  });

  it('wrapPairInRow (move соседа): ряд [цель, перемещённый], источник вырезан', () => {
    const s = sampleSchema();
    const { schema, newPath } = wrapPairInRow(s, P.step0field0, P.step0field1, 'after');
    expect(getAt(schema, P.step0children) as JsonNode[]).toHaveLength(1); // field1 ушёл
    const row = getAt(schema, P.step0field0) as {
      component: string;
      children: Array<{ value?: string }>;
    };
    expect(row.component).toBe('$html(div)');
    expect(row.children.map((c) => c.value)).toEqual(['$model(loanType)', '$model(loanAmount)']);
    expect(newPath).toEqual([...P.step0field0, 'children', 1]);
  });

  it('wrapPairInRow: узел в самого себя/предка → no-op', () => {
    const s = sampleSchema();
    expect(wrapPairInRow(s, P.step0, P.step0field0, 'after').schema).toBe(s);
  });

  it('unwrapSingleChild сворачивает вырожденный ряд в единственного ребёнка', () => {
    const wrapped = wrapInRow(sampleSchema(), P.step0field0, field('extra'), 'after').schema;
    const oneKid = removeAt(wrapped, [...P.step0field0, 'children', 1]);
    const { schema } = unwrapSingleChild(oneKid, P.step0field0);
    const node = getAt(schema, P.step0field0) as { value?: string; component?: string };
    expect(node.value).toBe('$model(loanType)');
    expect(node.component).toBe('$component(Select)');
  });

  it('removeNode авто-сворачивает ряд, оставшийся с одной колонкой', () => {
    const wrapped = wrapInRow(sampleSchema(), P.step0field0, field('extra'), 'after').schema;
    const { schema, newPath } = removeNode(wrapped, [...P.step0field0, 'children', 1]);
    expect((getAt(schema, P.step0field0) as { value?: string }).value).toBe('$model(loanType)');
    expect(newPath).toEqual([...P.step0field0]);
  });

  it('wrapInColumn создаёт вертикальный столбец (flex flex-col gap-4)', () => {
    const { schema, newPath } = wrapInColumn(
      sampleSchema(),
      P.step0field0,
      field('extra'),
      'after'
    );
    const col = getAt(schema, P.step0field0) as {
      component: string;
      componentProps: { className: string };
      children: Array<{ value?: string }>;
    };
    expect(col.component).toBe('$html(div)');
    expect(col.componentProps.className).toBe('flex flex-col gap-4');
    expect(col.children.map((c) => c.value)).toEqual(['$model(loanType)', '$model(extra)']);
    expect(newPath).toEqual([...P.step0field0, 'children', 1]);
  });

  it('wrapPairInColumn (move): вертикальный столбец [перемещённый, цель], источник вырезан', () => {
    const { schema } = wrapPairInColumn(sampleSchema(), P.step0field0, P.step0field1, 'before');
    expect(getAt(schema, P.step0children) as JsonNode[]).toHaveLength(1);
    const col = getAt(schema, P.step0field0) as {
      componentProps: { className: string };
      children: Array<{ value?: string }>;
    };
    expect(col.componentProps.className).toBe('flex flex-col gap-4');
    expect(col.children.map((c) => c.value)).toEqual(['$model(loanAmount)', '$model(loanType)']);
  });

  it('авто-unwrap сворачивает и вертикальный столбец до одной колонки', () => {
    const stacked = wrapInColumn(sampleSchema(), P.step0field0, field('extra'), 'after').schema;
    const { schema } = removeNode(stacked, [...P.step0field0, 'children', 1]);
    expect((getAt(schema, P.step0field0) as { value?: string }).value).toBe('$model(loanType)');
  });

  it('flipDirection переключает flex-col в className контейнера (туда и обратно)', () => {
    const row = wrapInRow(sampleSchema(), P.step0field0, field('extra'), 'after').schema;
    const cls = [...P.step0field0, 'componentProps', 'className'];
    expect(getAt(row, cls)).toBe('flex gap-4');
    const flipped = flipDirection(row, P.step0field0).schema;
    expect(getAt(flipped, cls)).toBe('flex flex-col gap-4');
    const back = flipDirection(flipped, P.step0field0).schema;
    expect(getAt(back, cls)).toBe('flex gap-4');
  });

  it('flipDirection нормализует не-flex div к flex (space-y → ряд → столбец)', () => {
    const div = {
      root: { component: '$html(div)', componentProps: { className: 'space-y-6' }, children: [] },
    } as unknown as JsonFormSchema;
    const cls = ['root', 'componentProps', 'className'];
    const row = flipDirection(div, ['root']).schema; // vertical → horizontal
    expect(getAt(row, cls)).toBe('flex space-y-6');
    const col = flipDirection(row, ['root']).schema; // → vertical
    expect(getAt(col, cls)).toBe('flex flex-col space-y-6');
  });

  it('flipDirection создаёт componentProps у голого div и снимает grid при перевороте', () => {
    const bare = { root: { component: '$html(div)', children: [] } } as unknown as JsonFormSchema;
    const flipped = flipDirection(bare, ['root']).schema; // default vertical → horizontal
    expect(getAt(flipped, ['root', 'componentProps', 'className'])).toBe('flex');

    const grid = {
      root: {
        component: '$html(div)',
        componentProps: { className: 'grid grid-cols-2 gap-4' },
        children: [],
      },
    } as unknown as JsonFormSchema;
    const stacked = flipDirection(grid, ['root']).schema; // grid(horizontal) → vertical, grid снят
    expect(getAt(stacked, ['root', 'componentProps', 'className'])).toBe('flex flex-col gap-4');
  });

  it('flipWrapperPair переворачивает обёртку и переставляет пару БЕЗ нового div', () => {
    // ряд [loanType, loanAmount] на месте step0field0
    const row = wrapPairInRow(sampleSchema(), P.step0field0, P.step0field1, 'after').schema;
    const colA = [...P.step0field0, 'children', 0]; // loanType
    const colB = [...P.step0field0, 'children', 1]; // loanAmount
    // перетащить colB на верх colA (side before)
    const { schema, newPath } = flipWrapperPair(row, P.step0field0, colA, colB, 'before');
    const div = getAt(schema, P.step0field0) as {
      component: string;
      componentProps: { className: string };
      children: Array<{ value?: string; component?: string }>;
    };
    expect(div.component).toBe('$html(div)'); // тот же div, не вложенный
    expect(div.componentProps.className).toBe('flex flex-col gap-4'); // перевернулся
    expect(div.children).toHaveLength(2); // всё ещё 2 колонки, без нового div
    expect(div.children.map((c) => c.value)).toEqual(['$model(loanAmount)', '$model(loanType)']);
    expect(newPath).toEqual([...P.step0field0, 'children', 0]);
  });
});

describe('reorderBlock / removeBlock (группа соседей)', () => {
  it('reorderBlock двигает блок вниз/вверх', () => {
    const s = sampleSchema();
    // [loanType(0), loanAmount(1)] → вниз блок [0] → [loanAmount, loanType]
    const down = reorderBlock(s, P.step0children, 0, 1, 1)!;
    expect(down.newStart).toBe(1);
    expect(
      (getAt(down.schema, P.step0children) as Array<{ value?: string }>).map((c) => c.value)
    ).toEqual(['$model(loanAmount)', '$model(loanType)']);
    // упор в границу → null
    expect(reorderBlock(s, P.step0children, 0, 1, -1)).toBeNull();
    expect(reorderBlock(s, P.step0children, 1, 1, 1)).toBeNull();
  });

  it('removeBlock вырезает непрерывный блок', () => {
    const s = sampleSchema();
    const next = removeBlock(s, P.step0children, 0, 2); // удалить обе колонки
    expect(getAt(next, P.step0children) as unknown[]).toHaveLength(0);
  });

  it('removeIndices удаляет несмежные индексы без сдвига', () => {
    const s3 = appendNode(sampleSchema(), P.step0children, field('third')).schema;
    // [loanType(0), loanAmount(1), third(2)] → удалить [0,2] → остаётся loanAmount
    const next = removeIndices(s3, P.step0children, [0, 2]);
    expect((getAt(next, P.step0children) as Array<{ value?: string }>).map((c) => c.value)).toEqual(
      ['$model(loanAmount)']
    );
  });
});

describe('groupBlock / ungroupNode (группировка)', () => {
  it('groupBlock оборачивает смежный блок в вертикальный div', () => {
    const { schema, newPath } = groupBlock(sampleSchema(), P.step0children, 0, 2);
    const kids = getAt(schema, P.step0children) as Array<{
      component?: string;
      componentProps?: { className?: string };
      children?: Array<{ value?: string }>;
    }>;
    expect(kids).toHaveLength(1);
    expect(kids[0].component).toBe('$html(div)');
    expect(kids[0].componentProps?.className).toBe('flex flex-col gap-4');
    expect(kids[0].children?.map((c) => c.value)).toEqual([
      '$model(loanType)',
      '$model(loanAmount)',
    ]);
    expect(newPath).toEqual([...P.step0children, 0]);
  });

  it('ungroupNode заменяет div его детьми; не-div → no-op', () => {
    const grouped = groupBlock(sampleSchema(), P.step0children, 0, 2).schema;
    const { schema } = ungroupNode(grouped, [...P.step0children, 0]);
    expect(
      (getAt(schema, P.step0children) as Array<{ value?: string }>).map((c) => c.value)
    ).toEqual(['$model(loanType)', '$model(loanAmount)']);
    const s = sampleSchema();
    expect(ungroupNode(s, P.step0field0).schema).toBe(s); // поле, не div
  });
});

describe('setTextChild / textChildIndex', () => {
  const node = (children?: unknown[]): JsonFormSchema =>
    ({
      version: '1.0',
      root: { component: '$html(p)', ...(children ? { children } : {}) },
    }) as unknown as JsonFormSchema;
  const kidsOf = (s: JsonFormSchema): unknown[] => getAt(s, ['root', 'children']) as unknown[];

  it('добавляет текстовую часть первой, если её не было', () => {
    const s = setTextChild(node([{ component: '$html(b)' }]), ['root'], 'Внимание').schema;
    expect(kidsOf(s)).toEqual(['Внимание', { component: '$html(b)' }]);
  });

  it('переписывает существующую часть на месте — порядок относительно узлов сохраняется', () => {
    const s = setTextChild(node([{ component: '$html(b)' }, ' старый']), ['root'], ' новый').schema;
    expect(kidsOf(s)).toEqual([{ component: '$html(b)' }, ' новый']);
  });

  it('пустая строка убирает текстовую часть, узлы остаются', () => {
    const s = setTextChild(node(['текст', { component: '$html(b)' }]), ['root'], '').schema;
    expect(kidsOf(s)).toEqual([{ component: '$html(b)' }]);
  });

  it('textChildIndex: -1 без текста, индекс единственной части, null при нескольких', () => {
    expect(textChildIndex({ component: '$html(p)' } as never)).toBe(-1);
    expect(textChildIndex({ component: '$html(p)', children: [{}, 'x'] } as never)).toBe(1);
    expect(textChildIndex({ component: '$html(p)', children: ['a', 'b'] } as never)).toBeNull();
  });
});
