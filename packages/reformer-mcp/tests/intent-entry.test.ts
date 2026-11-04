/**
 * Точка входа `@reformer/mcp/intent`: компилятор intent для встраивания (ассистент билдера).
 *
 * Проверяется обещание точки входа, а не сам компилятор — его покрывают тесты генератора: экспорты
 * на месте, и цепочка, которой пользуется билдер (чтение → раскладка → ссылки раскладки → печать
 * правил), проходит на intent с шагами, массивом и правилами.
 */
import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import {
  buildBehaviorTs,
  buildSchemaLayout,
  buildValidationSchemaTs,
  collectSteps,
  findCycle,
  inspectLayoutRefs,
  MODULE_ONLY_WARNINGS,
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

  it('предупреждения несут код, forDocument снимает те, что про печать модуля', () => {
    const raw = {
      fields: [
        { name: 'email', label: 'Email', required: true },
        { name: 'city', type: 'Select', label: 'City' },
      ],
      arrays: [{ name: 'kids', itemFields: [{ name: 'name', component: 'Input' }] }],
    };
    const module = readIntent(raw, { uiKit: CATALOGS.uiKit });
    const codes = module.notices.map((notice) => notice.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'type-default',
        'component-default',
        'type-is-component',
        'required-lifted',
        'item-interface-default',
        'initial-value-default',
      ])
    );
    expect(module.intent.warnings).toEqual(module.notices.map((notice) => notice.message));
    expect(module.notices.find((n) => n.code === 'type-is-component')?.at).toBe('fields[1]');

    const document = readIntent(raw, { forDocument: true, uiKit: CATALOGS.uiKit });
    expect(document.notices.map((notice) => notice.code)).toEqual(['type-is-component']);
    expect(document.intent.warnings).toHaveLength(1);
    expect(document.intent.fields.map((f) => f.component)).toEqual(
      module.intent.fields.map((f) => f.component)
    );
    for (const code of MODULE_ONLY_WARNINGS) {
      expect(document.notices.some((notice) => notice.code === code)).toBe(false);
    }
  });

  it('свои предупреждения intent сохраняются кодом consumer и в начале списка', () => {
    const { notices } = readIntent({ warnings: ['из спеки'], fields: [] });
    expect(notices[0]).toEqual({ code: 'consumer', message: 'из спеки' });
  });

  it('нормализация компонента и intent доступны отдельно', () => {
    expect(normalizeFieldComponent('Input', 'number').component).toBe('InputNumber');
    expect(normalizeIntent({ fields: [] }).layoutRoot.kind).toBe('container');
  });
});
