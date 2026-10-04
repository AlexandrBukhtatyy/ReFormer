/**
 * Проверяются три свойства, каждое из которых при поломке молчит:
 * форма идентификатора, structural sharing обхода и то, что копия НЕ уносит чужой адрес.
 *
 * Генератор всюду подставной: тест на случайных данных проверял бы только длину строки.
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  NODE_ID_PATTERN,
  assignNodeIds,
  createNodeIdFactory,
  ensureNodeIds,
  findDuplicateNodeIds,
  isNodeId,
  newNodeId,
  nodeIdOf,
  reissueNodeIds,
  type IdentifiedNode,
} from './node-id';
import { isNodeLike } from './node-kind';
import { getAt } from './paths';
import { walkNodes } from './query';
import { sampleSchema, P } from './__fixtures__/sample-schema';

/** Источник, отдающий заданные байты по кругу, — тест задаёт идентификаторы, а не подсматривает их. */
function bytesFrom(sequence: readonly number[]) {
  let i = 0;
  return (out: Uint8Array) => {
    for (let k = 0; k < out.length; k++) out[k] = sequence[i++ % sequence.length];
  };
}

/** Счётчик: `00000000`, `00000001`, … — читаемые идентификаторы для проверок по дереву. */
function countingIds() {
  let n = 0;
  return () => String(n++).padStart(8, '0');
}

const idOf = (schema: JsonFormSchema, path: readonly (string | number)[]) =>
  nodeIdOf(getAt(schema, path) as JsonNode);

describe('форма идентификатора', () => {
  it('8 символов base36', () => {
    const id = newNodeId();
    expect(id).toMatch(NODE_ID_PATTERN);
    expect(id).toHaveLength(8);
  });

  it('isNodeId отвергает всё, что не восемь символов [0-9a-z]', () => {
    expect(isNodeId('abc12345')).toBe(true);
    expect(isNodeId('ABC12345')).toBe(false); // верхний регистр — не base36-строчный
    expect(isNodeId('abc1234')).toBe(false); // семь
    expect(isNodeId('abc123456')).toBe(false); // девять
    expect(isNodeId('abc-1234')).toBe(false);
    expect(isNodeId(12345678)).toBe(false);
    expect(isNodeId(undefined)).toBe(false);
  });
});

describe('createNodeIdFactory', () => {
  it('детерминирован: те же байты — тот же идентификатор', () => {
    const next = createNodeIdFactory(bytesFrom([0, 1, 2, 3, 34, 35, 36, 37]));
    // 0→'0', 1→'1', 2→'2', 3→'3', 34→'y', 35→'z', 36→'0' (36 % 36), 37→'1'
    expect(next()).toBe('0123yz01');
    expect(next()).toBe('0123yz01');
  });

  it('два независимых генератора на одном источнике дают одно и то же', () => {
    const seq = [7, 200, 13, 99, 251, 42, 1, 128];
    expect(createNodeIdFactory(bytesFrom(seq))()).toBe(createNodeIdFactory(bytesFrom(seq))());
  });

  it('отбрасывает байты ≥ 252 — иначе первые четыре символа алфавита выпадали бы чаще', () => {
    // 252..255 пропускаются, поэтому идентификатор собирается из следующего захода буфера.
    const next = createNodeIdFactory(bytesFrom([252, 253, 254, 255, 0, 0, 0, 0, 5, 5, 5, 5]));
    const id = next();
    expect(id).toMatch(NODE_ID_PATTERN);
    expect(id).toBe('00005555');
  });

  it('сломанный источник не вешает цикл, а бросает', () => {
    const next = createNodeIdFactory((out) => out.fill(255));
    expect(() => next()).toThrow(/источник случайности/);
  });

  it('умолчание поверх crypto выдаёт разные идентификаторы', () => {
    const ids = new Set(Array.from({ length: 64 }, () => newNodeId()));
    expect(ids.size).toBe(64);
  });
});

describe('ensureNodeIds', () => {
  it('каждый узел схемы получает идентификатор — включая шаги и шаблон элемента массива', () => {
    const next = countingIds();
    const withIds = ensureNodeIds(sampleSchema(), next);

    const seen: string[] = [];
    walkNodes(withIds, (node) => {
      const id = nodeIdOf(node);
      expect(id).toBeDefined();
      seen.push(id as string);
    });

    // корень, два шага, два поля, массив, шаблон и поле внутри него
    expect(seen).toHaveLength(8);
    expect(new Set(seen).size).toBe(8); // все разные
    expect(idOf(withIds, P.arrayTemplate)).toBeDefined();
  });

  it('идентификатор стоит первым ключом узла: в diff его видно сразу', () => {
    const withIds = ensureNodeIds(sampleSchema(), countingIds());
    expect(Object.keys(withIds.root)[0]).toBe('$nodeId');
  });

  it('оригинал не изменяется', () => {
    const source = sampleSchema();
    ensureNodeIds(source, countingIds());
    expect((source.root as IdentifiedNode).$nodeId).toBeUndefined();
  });

  it('structural sharing: ветка, где все узлы уже с идентификаторами, — та же по ссылке', () => {
    const first = ensureNodeIds(sampleSchema(), countingIds());

    // Убираем идентификатор у ОДНОГО поля первого шага; шаг 1 остаётся полностью размеченным.
    const broken = structuredClone(first) as JsonFormSchema;
    delete (getAt(broken, P.step0field1) as IdentifiedNode).$nodeId;
    const step1Before = getAt(broken, P.step1);
    const step0field0Before = getAt(broken, P.step0field0);

    const fixed = ensureNodeIds(broken, countingIds());

    // Нетронутая ветка — та же ссылка.
    expect(getAt(fixed, P.step1)).toBe(step1Before);
    // Сосед внутри изменённого шага — тоже та же ссылка: клонируется только путь до правки.
    expect(getAt(fixed, P.step0field0)).toBe(step0field0Before);
    // А путь до правки — новые объекты.
    expect(fixed).not.toBe(broken);
    expect(getAt(fixed, P.step0)).not.toBe(getAt(broken, P.step0));
    expect(idOf(fixed, P.step0field1)).toBeDefined();
  });

  it('полностью размеченная схема возвращается САМА СОБОЙ (второй проход ничего не стоит)', () => {
    const once = ensureNodeIds(sampleSchema(), countingIds());
    expect(ensureNodeIds(once, countingIds())).toBe(once);
  });

  it('существующие идентификаторы сохраняются, выдаются только недостающие', () => {
    const before = ensureNodeIds(sampleSchema(), countingIds());
    const rootId = idOf(before, P.root);
    const broken = structuredClone(before) as JsonFormSchema;
    delete (getAt(broken, P.array) as IdentifiedNode).$nodeId;

    const after = ensureNodeIds(broken, () => 'zzzzzzzz');
    expect(idOf(after, P.root)).toBe(rootId);
    expect(idOf(after, P.array)).toBe('zzzzzzzz');
  });

  it('значение НЕ той формы считается чужим и переписывается на своём месте', () => {
    const schema = {
      version: '1.0',
      root: { $nodeId: 'ЧУЖОЕ', component: '$html(div)', children: [] },
    } as unknown as JsonFormSchema;
    const fixed = ensureNodeIds(schema, () => 'abcd1234');
    expect(nodeIdOf(fixed.root)).toBe('abcd1234');
    expect(Object.keys(fixed.root)[0]).toBe('$nodeId');
  });

  it('текстовые части children идентификаторов не получают и с места не съезжают', () => {
    const schema = {
      version: '1.0',
      root: {
        component: '$html(p)',
        children: ['Внимание! ', { component: '$html(b)', children: ['важно'] }, ' конец'],
      },
    } as unknown as JsonFormSchema;
    const fixed = ensureNodeIds(schema, countingIds());
    const kids = (fixed.root as { children: unknown[] }).children;
    expect(kids[0]).toBe('Внимание! ');
    expect(kids[2]).toBe(' конец');
    expect(nodeIdOf(kids[1] as JsonNode)).toBeDefined();
  });

  it('размечает обёртку поля (`wrapper`) — слот одиночный, но узел настоящий', () => {
    const schema = {
      version: '1.0',
      root: {
        value: '$model(email)',
        component: '$component(Input)',
        wrapper: { component: '$component(FormField)', children: [] },
      },
    } as unknown as JsonFormSchema;
    const fixed = ensureNodeIds(schema, countingIds());
    expect(nodeIdOf((fixed.root as { wrapper: JsonNode }).wrapper)).toBeDefined();
  });
});

describe('уникальность адресов', () => {
  /** Схема с двумя узлами под одним адресом — след копипасты или склейки двух файлов. */
  function twins(id = 'aaaaaaaa'): JsonFormSchema {
    return {
      version: '1.0',
      root: {
        $nodeId: 'rrrrrrrr',
        component: '$html(div)',
        children: [
          { $nodeId: id, value: '$model(a)', component: '$component(Input)' },
          { $nodeId: id, value: '$model(b)', component: '$component(Input)' },
        ],
      },
    } as unknown as JsonFormSchema;
  }

  it('первый носитель адрес сохраняет, второй получает новый', () => {
    const fixed = ensureNodeIds(twins(), () => 'zzzzzzzz');
    expect(idOf(fixed, ['root', 'children', 0])).toBe('aaaaaaaa');
    expect(idOf(fixed, ['root', 'children', 1])).toBe('zzzzzzzz');
  });

  it('перевыданный адрес встаёт первым ключом, остальные ключи на местах', () => {
    const fixed = ensureNodeIds(twins(), () => 'zzzzzzzz');
    const second = getAt(fixed, ['root', 'children', 1]) as Record<string, unknown>;
    expect(Object.keys(second)).toEqual(['$nodeId', 'value', 'component']);
  });

  it('assignNodeIds называет починенный адрес, а не молчит о нём', () => {
    const { duplicates } = assignNodeIds(twins(), countingIds());
    expect(duplicates).toEqual(['aaaaaaaa']);
  });

  it('чистая схема ничего не сообщает и возвращается ТОЙ ЖЕ по ссылке', () => {
    const clean = ensureNodeIds(sampleSchema(), countingIds());
    const result = assignNodeIds(clean, () => 'zzzzzzzz');
    expect(result.duplicates).toEqual([]);
    expect(result.schema).toBe(clean);
  });

  it('двойник ловится и в неоднородных слотах: шаги мастера и шаблон элемента', () => {
    const schema = {
      version: '1.0',
      root: {
        $nodeId: 'rrrrrrrr',
        component: '$component(FormWizard)',
        componentProps: {
          steps: [
            { $nodeId: 'ssssssss', component: '$html(div)', children: [] },
            {
              $nodeId: 'ssssssss',
              array: '$model(items)',
              component: '$component(FormArray)',
              item: { $template: { $nodeId: 'ssssssss', component: '$html(div)', children: [] } },
            },
          ],
        },
      },
    } as unknown as JsonFormSchema;

    const ids = countingIds();
    const { schema: fixed, duplicates } = assignNodeIds(schema, ids);
    expect(duplicates).toEqual(['ssssssss']);
    const all: string[] = [];
    walkNodes(fixed, (node) => {
      const id = nodeIdOf(node);
      if (id !== undefined) all.push(id);
    });
    expect(new Set(all).size).toBe(all.length);
  });

  it('после починки двойников не остаётся ни одного', () => {
    const fixed = ensureNodeIds(twins(), countingIds());
    expect(findDuplicateNodeIds(fixed)).toEqual([]);
  });

  it('findDuplicateNodeIds не считает находкой безадресный узел', () => {
    const schema = {
      version: '1.0',
      root: { component: '$html(div)', children: [{ component: '$html(span)', children: [] }] },
    } as unknown as JsonFormSchema;
    expect(findDuplicateNodeIds(schema)).toEqual([]);
  });

  it('findDuplicateNodeIds видит двойника и не чинит схему', () => {
    const schema = twins();
    expect(findDuplicateNodeIds(schema)).toEqual(['aaaaaaaa']);
    expect(idOf(schema, ['root', 'children', 1])).toBe('aaaaaaaa');
  });

  it('копия ЧЕРЕЗ reissueNodeIds двойников не создаёт, даже вставленная рядом с оригиналом', () => {
    const source = ensureNodeIds(twins('bbbbbbbb'), countingIds());
    const copy = reissueNodeIds(
      getAt(source, ['root', 'children', 0]) as JsonNode,
      () => 'qqqqqqqq'
    );
    expect(nodeIdOf(copy)).toBe('qqqqqqqq');
  });
});

describe('reissueNodeIds', () => {
  it('всё поддерево получает НОВЫЕ идентификаторы: копия не уносит адрес оригинала', () => {
    const withIds = ensureNodeIds(sampleSchema(), countingIds());
    const original = getAt(withIds, P.array) as JsonNode;

    const copy = reissueNodeIds(original, createNodeIdFactory(bytesFrom([9])));

    const originalIds = new Set<string>();
    collect(original, originalIds);
    const copyIds = new Set<string>();
    collect(copy, copyIds);

    expect(copyIds.size).toBeGreaterThan(0);
    for (const id of copyIds) expect(originalIds.has(id)).toBe(false);
  });

  it('оригинал не изменяется — поддерево копируется целиком', () => {
    const withIds = ensureNodeIds(sampleSchema(), countingIds());
    const original = getAt(withIds, P.array) as JsonNode;
    const before = structuredClone(original);

    const copy = reissueNodeIds(original, countingIds());

    expect(original).toEqual(before);
    expect(copy).not.toBe(original);
  });

  it('размечает и узел БЕЗ идентификатора — результат размечен целиком', () => {
    const node = {
      component: '$html(div)',
      children: [{ value: '$model(a)', component: '$component(Input)' }],
    } as unknown as JsonNode;
    const copy = reissueNodeIds(node, countingIds());
    const ids = new Set<string>();
    collect(copy, ids);
    expect(ids.size).toBe(2);
  });

  it('идентификаторы внутри копии остаются различимыми (двойников не появляется)', () => {
    const withIds = ensureNodeIds(sampleSchema(), countingIds());
    const copy = reissueNodeIds(withIds.root, countingIds());
    const ids: string[] = [];
    collect(copy, new Set(), ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * Собрать идентификаторы поддерева. Свой обход, а не `walkNodes`: тому нужна схема, а здесь
 * проверяется отдельно взятый узел — ровно то, что уходит в буфер обмена.
 */
function collect(node: JsonNode, into: Set<string>, list?: string[]): void {
  const id = nodeIdOf(node);
  if (id) {
    into.add(id);
    list?.push(id);
  }
  const rec = (v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach(rec);
      return;
    }
    if (isNodeLike(v)) collect(v, into, list);
  };
  const n = node as unknown as Record<string, unknown>;
  rec(n.children);
  rec((n.componentProps as Record<string, unknown> | undefined)?.steps);
  rec((n.item as Record<string, unknown> | undefined)?.$template);
  rec(n.wrapper);
}
