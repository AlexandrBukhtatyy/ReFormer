import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { annotateSchema } from './annotate-schema';
import { decodeNodeToken, tokenFromClassName, EMPTY_CLASS } from './node-token';
import { childSlots, getAt, pathEquals, type JsonPath } from '../model';
import { getCatalog } from '../catalog';
import { sampleSchema, P } from '../model/__fixtures__/sample-schema';

/** Все пути узлов схемы в обходе `childSlots` — тот же обход, что у canvas и drag-drop. */
function allNodePaths(schema: JsonFormSchema): JsonPath[] {
  const out: JsonPath[] = [];
  const walk = (node: JsonNode, path: JsonPath) => {
    out.push(path);
    for (const slot of childSlots(node, path)) {
      slot.entries.forEach((entry) =>
        walk(entry.node, slot.single ? slot.path : [...slot.path, entry.index])
      );
    }
  };
  walk(schema.root, ['root']);
  return out;
}

const classOf = (schema: JsonFormSchema, path: JsonPath): string =>
  (getAt(schema, path) as JsonNode as { componentProps?: { className?: string } }).componentProps
    ?.className ?? '';

describe('annotateSchema', () => {
  it('каждый узел получает токен своего пути', () => {
    const src = sampleSchema();
    const annotated = annotateSchema(src);
    for (const path of allNodePaths(src)) {
      const token = tokenFromClassName(classOf(annotated, path));
      expect(token, `нет токена у ${path.join('.')}`).not.toBeNull();
      expect(decodeNodeToken(token!)).toEqual(path);
    }
  });

  it('токен ведёт обратно к тому же узлу (getAt по раскодированному пути)', () => {
    const src = sampleSchema();
    const annotated = annotateSchema(src);
    const token = tokenFromClassName(classOf(annotated, [...P.step0field1]))!;
    const path = decodeNodeToken(token)!;
    expect(pathEquals(path, [...P.step0field1])).toBe(true);
    expect((getAt(src, path) as { value?: string }).value).toBe('$model(loanAmount)');
  });

  it('исходная схема не мутируется и не содержит токенов', () => {
    const src = sampleSchema();
    const before = JSON.stringify(src);
    annotateSchema(src);
    expect(JSON.stringify(src)).toBe(before);
    expect(before).not.toContain('rbnode-');
  });

  it('существующий className сохраняется и стоит перед токеном', () => {
    const annotated = annotateSchema(sampleSchema());
    expect(classOf(annotated, [...P.root]).startsWith('bg-white ')).toBe(true);
  });

  it('array-узел без component получает дефолтные отступы вместе с токеном', () => {
    const annotated = annotateSchema(sampleSchema());
    expect(classOf(annotated, [...P.array])).toContain('space-y-3 mt-2');
  });

  it('array-узел со своим className дефолт не получает', () => {
    const src = sampleSchema();
    const arr = getAt(src, [...P.array]) as { componentProps: Record<string, unknown> };
    arr.componentProps.className = 'my-list';
    const annotated = annotateSchema(src);
    const cls = classOf(annotated, [...P.array]);
    expect(cls.startsWith('my-list ')).toBe(true);
    expect(cls).not.toContain('space-y-3');
  });

  it('template массива аннотируется своим путём', () => {
    const annotated = annotateSchema(sampleSchema());
    const token = tokenFromClassName(classOf(annotated, [...P.arrayTemplate]))!;
    expect(decodeNodeToken(token)).toEqual([...P.arrayTemplate]);
  });

  it('контейнер без детей помечается служебным классом, непустой — нет', () => {
    const schema = {
      root: {
        component: '$html(div)',
        children: [
          { component: '$html(div)', children: [] },
          { component: '$html(span)', children: ['x'] },
        ],
      },
    } as unknown as JsonFormSchema;
    const annotated = annotateSchema(schema);
    expect(classOf(annotated, ['root', 'children', 0])).toContain(EMPTY_CLASS);
    expect(classOf(annotated, ['root', 'children', 1])).not.toContain(EMPTY_CLASS);
    expect(classOf(annotated, ['root'])).not.toContain(EMPTY_CLASS);
  });

  it('каждый узел каталога палитры получает токен (ни один вид узла не пропущен)', () => {
    const schema = {
      version: '1.0',
      root: { component: '$component(Box)', children: getCatalog().map((e) => e.makeNode()) },
    } as unknown as JsonFormSchema;
    const annotated = annotateSchema(schema);
    for (const path of allNodePaths(schema)) {
      expect(
        tokenFromClassName(classOf(annotated, path)),
        `нет токена у ${path.join('.')}`
      ).not.toBeNull();
    }
  });

  it('поле с wrapper: обёртка получает собственный токен', () => {
    const schema = {
      root: {
        component: '$html(div)',
        children: [
          {
            value: '$model(a)',
            component: '$component(Input)',
            wrapper: { component: '$component(FormField)' },
          },
        ],
      },
    } as unknown as JsonFormSchema;
    const annotated = annotateSchema(schema);
    const token = tokenFromClassName(classOf(annotated, ['root', 'children', 0, 'wrapper']))!;
    expect(decodeNodeToken(token)).toEqual(['root', 'children', 0, 'wrapper']);
  });
});
