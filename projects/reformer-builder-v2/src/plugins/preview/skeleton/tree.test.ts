/**
 * Каркас схемы: вложенность, подписи, устойчивость к отсутствию кита.
 *
 * @module plugins/preview/skeleton/tree.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { ensureNodeIds, newNodeId } from '@/lib/form-model/node-id';
import { buildSkeleton, skeletonSize, skeletonTitle } from './tree';

describe('buildSkeleton', () => {
  it('разворачивает шаги визарда, шаблон массива и вложенные поля', () => {
    const tree = buildSkeleton(sampleSchema());
    expect(tree).not.toBeNull();
    expect(tree?.kind).toBe('container');
    // Корень, два шага, два поля первого шага, массив, шаблон и поле внутри него.
    expect(skeletonSize(tree)).toBe(8);
  });

  it('слот запоминается: шаг лежит в steps, а поле — в children', () => {
    const tree = buildSkeleton(sampleSchema());
    const step = tree?.children[0];
    expect(step?.slot).toBe('steps');
    expect(step?.children[0]?.slot).toBe('children');
  });

  it('привязка к модели видна у поля и у массива, но не у контейнера', () => {
    const tree = buildSkeleton(sampleSchema());
    expect(tree?.binding).toBeNull();
    expect(tree?.children[0]?.children[0]?.binding).toBe('loanType');
    expect(tree?.children[1]?.children[0]?.binding).toBe('properties');
  });

  it('адрес узла попадает в каркас, когда он есть', () => {
    const tree = buildSkeleton(ensureNodeIds(sampleSchema(), newNodeId));
    expect(tree?.id).toMatch(/^[0-9a-z]{8}$/);
  });

  it('узел без адреса рисуется, но остаётся невыбираемым', () => {
    expect(buildSkeleton(sampleSchema())?.id).toBeNull();
  });

  it('листья кита вложенности не получают', () => {
    const schema: JsonFormSchema = {
      version: '1.0',
      root: { component: '$component(Box)', children: [{ component: '$component(Text)' }] },
    } as unknown as JsonFormSchema;
    // Множество листьев принадлежит АКТИВНОМУ киту: тот же узел у одного кита лист,
    // у другого — контейнер. Без набора действует умолчание домена, а не «листьев нет».
    expect(skeletonSize(buildSkeleton(schema, new Set(['Box'])))).toBe(1);
    expect(skeletonSize(buildSkeleton(schema, new Set()))).toBe(2);
  });
});

describe('skeletonTitle', () => {
  it('подпись поля важнее селектора и компонента', () => {
    const node = {
      value: '$model(x)',
      component: '$component(Input)',
      componentProps: { label: 'Сумма' },
    } as unknown as JsonNode;
    expect(skeletonTitle(node)).toBe('Сумма');
  });

  it('селектор берётся, когда подписи нет', () => {
    const node = { selector: 'properties-array', array: '$model(p)' } as unknown as JsonNode;
    expect(skeletonTitle(node)).toBe('properties-array');
  });

  it('html-узел показывается тегом, а не обёрткой оператора', () => {
    expect(skeletonTitle({ component: '$html(div)' } as unknown as JsonNode)).toBe('div');
  });
});
