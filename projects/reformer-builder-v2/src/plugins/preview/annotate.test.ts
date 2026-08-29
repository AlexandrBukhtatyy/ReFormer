/**
 * Аннотация схемы: токены доезжают до всех видов узлов, исходная схема не мутируется.
 *
 * @module plugins/preview/annotate.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { ensureNodeIds, newNodeId, nodeIdOf } from '@/lib/form-model/node-id';
import { walkNodes } from '@/lib/form-model/query';
import { annotateSchema } from './annotate';
import { EMPTY_CLASS, encodeNodeToken } from './node-token';

function identified(): JsonFormSchema {
  return ensureNodeIds(sampleSchema(), newNodeId);
}

function classOf(node: JsonNode): string {
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
  return typeof props?.className === 'string' ? props.className : '';
}

describe('annotateSchema', () => {
  it('каждому узлу с адресом дописан его токен', () => {
    const schema = identified();
    const annotated = annotateSchema(schema);

    let checked = 0;
    walkNodes(annotated, (node) => {
      const id = nodeIdOf(node);
      if (id === undefined) return;
      expect(classOf(node)).toContain(encodeNodeToken(id));
      checked += 1;
    });
    expect(checked).toBeGreaterThan(3);
  });

  it('исходная схема не мутируется', () => {
    const schema = identified();
    const before = JSON.stringify(schema);
    annotateSchema(schema);
    expect(JSON.stringify(schema)).toBe(before);
  });

  it('существующий className сохраняется, а не затирается', () => {
    const annotated = annotateSchema(identified());
    expect(classOf(annotated.root)).toContain('bg-white');
  });

  it('узел без адреса токена не получает и className не заводит', () => {
    const schema = sampleSchema();
    const annotated = annotateSchema(schema);
    walkNodes(annotated, (node) => {
      expect(classOf(node)).not.toContain('rbnode-');
    });
  });

  it('пустой контейнер помечается служебным классом, иначе он схлопнется в ноль пикселей', () => {
    const schema: JsonFormSchema = {
      version: '1.0',
      root: { component: '$component(Box)', children: [] },
    } as JsonFormSchema;
    expect(classOf(annotateSchema(schema).root)).toContain(EMPTY_CLASS);
  });

  it('array-узлу без своего компонента подставляется дефолт отступов рендерера', () => {
    const schema: JsonFormSchema = {
      version: '1.0',
      root: {
        array: '$model(items)',
        item: { $template: { component: '$component(Box)', children: [] } },
      },
    } as unknown as JsonFormSchema;
    expect(classOf(annotateSchema(schema).root)).toContain('space-y-3');
  });
});
