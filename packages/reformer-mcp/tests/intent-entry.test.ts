/**
 * Точка входа `@reformer/mcp/intent`: компилятор intent для встраивания (ассистент билдера).
 *
 * Проверяется обещание точки входа, а не сам компилятор — его покрывают тесты генератора: экспорты
 * на месте, и цепочка, которой пользуется билдер (чтение → раскладка → ссылки раскладки → печать
 * правил), проходит на intent с шагами, массивом и правилами.
 */
import { describe, expect, it } from 'vitest';
import {
  buildBehaviorTs,
  buildSchemaLayout,
  buildValidationSchemaTs,
  collectSteps,
  findCycle,
  inspectLayoutRefs,
  modelPaths,
  normalizeFieldComponent,
  normalizeIntent,
  readIntent,
} from '../src/core/intent';
import packageJson from '../package.json';

describe('@reformer/mcp/intent', () => {
  it('объявлена в exports пакета и указывает на собранный модуль', () => {
    expect((packageJson.exports as Record<string, string>)['./intent']).toBe(
      './dist/core/intent.js'
    );
  });

  it('цепочка билдера проходит на intent с шагами, массивом и правилами', () => {
    const { intent, problems } = readIntent({
      fields: [
        { name: 'email', component: 'Input', label: 'Email', required: true },
        { name: 'price', component: 'InputNumber', label: 'Price' },
        { name: 'total', component: 'InputNumber', label: 'Total' },
      ],
      arrays: [{ name: 'kids', itemFields: [{ name: 'name', component: 'Input' }] }],
      layoutRoot: {
        kind: 'container',
        component: 'Box',
        children: [
          { kind: 'step', title: 'One', children: ['email', 'price'] },
          { kind: 'step', title: 'Two', children: ['total', { kind: 'array', ref: 'kids' }] },
        ],
      },
      behavior: [{ kind: 'compute', target: 'total', sources: ['price'], expr: 'model.price' }],
    });
    expect(problems).toEqual([]);
    expect(collectSteps(intent.layoutRoot)).toHaveLength(2);
    expect(inspectLayoutRefs(intent).unknown).toEqual([]);
    expect([...modelPaths(intent)]).toEqual(expect.arrayContaining(['email', 'kids.name']));
    const { document } = buildSchemaLayout(intent);
    expect(document.root.component).toBe('$component(FormWizard)');
    expect(Object.keys(document.parts ?? {})).toEqual(['kidsRow']);
    expect(
      buildValidationSchemaTs(intent.validation, {
        interfaceName: intent.interfaceName,
        exportName: 'rules',
        typeImport: './types',
      })
    ).toContain('required');
    expect(buildBehaviorTs(intent)).toContain('total');
    expect(findCycle([{ target: 'a', reads: ['a'] }])).not.toBeNull();
  });

  it('нормализация компонента и intent доступны отдельно', () => {
    expect(normalizeFieldComponent('Input', 'number').component).toBe('InputNumber');
    expect(normalizeIntent({ fields: [] }).layoutRoot.kind).toBe('container');
  });
});
