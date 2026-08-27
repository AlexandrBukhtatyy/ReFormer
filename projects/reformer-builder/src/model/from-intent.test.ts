/**
 * Мост «intent → форма редактора».
 *
 * Проверяется не «получилась ли схема», а два свойства, каждое из которых уже однажды
 * оказывалось ложным: схема валидна по контракту renderer-json (иначе форма не откроется
 * вовсе), и словарь компонентов переведён на тот, которым говорит редактор.
 */

import { describe, expect, it } from 'vitest';
import { normalizeIntent } from '@reformer/mcp/dist/core/generate/form-intent.js';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { knownComponentNames } from '../preview-runtime/known-names';
import { formFromIntent } from './from-intent';

/** Спека-минимум: поле, справочник, правило, вычисление и массив — всё, что бывает у формы. */
function intent() {
  return normalizeIntent({
    formName: 'Заявка',
    target: 'renderer-json',
    fields: [
      { name: 'email', type: 'string', component: 'Input', label: 'Email' },
      { name: 'price', type: 'number', component: 'Input' },
      { name: 'quantity', type: 'number', component: 'Input' },
      { name: 'total', type: 'number', component: 'Input' },
      { name: 'currency', type: 'string', component: 'Select', optionsSource: 'CURRENCIES' },
    ],
    arrays: [
      {
        name: 'items',
        itemInterfaceName: 'Item',
        itemFields: [{ name: 'sku', type: 'string', component: 'Input' }],
        initialValue: [],
      },
    ],
    dataSources: [{ name: 'CURRENCIES' }],
    validation: [{ target: 'email', rules: ['required()'] }],
    behavior: [
      {
        kind: 'computeFrom',
        target: 'total',
        sources: ['price', 'quantity'],
        expr: 'price * quantity',
      },
    ],
  });
}

describe('formFromIntent', () => {
  it('схема валидна по контракту renderer-json', () => {
    const { schema } = formFromIntent(intent());
    const res = validateFormSchema(schema);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });

  it('массив переведён на имя, которым его адресует редактор', () => {
    // MCP пишет `$component(FormArray)` — имя компонента ui-kit. Реестр билдера знает этот узел
    // как `List`; без перевода массив открылся бы неизвестным компонентом и не отрисовался.
    const { schema, warnings } = formFromIntent(intent());
    const json = JSON.stringify(schema);
    expect(json).toContain('$component(List)');
    expect(json).not.toContain('FormArray');
    expect(warnings.filter((w) => w.includes('неизвестен'))).toEqual([]);
  });

  it('все компоненты схемы известны редактору', () => {
    const { schema } = formFromIntent(intent());
    const known = new Set(knownComponentNames());
    const used = [...JSON.stringify(schema).matchAll(/\$component\(([^)]*)\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((n) => !known.has(n))).toEqual([]);
  });

  it('неизвестный компонент не молчит, а попадает в предупреждения', () => {
    const withUnknown = normalizeIntent({
      formName: 'X',
      target: 'renderer-json',
      fields: [{ name: 'a', type: 'string', component: 'НетТакого' }],
    });
    const { warnings } = formFromIntent(withUnknown);
    expect(warnings.some((w) => w.includes('НетТакого'))).toBe(true);
  });

  it('правила переносятся один в один', () => {
    const { rules } = formFromIntent(intent());
    expect(rules.validation).toHaveLength(1);
    expect(rules.validation[0].target).toBe('email');
    expect(rules.behavior[0].kind).toBe('computeFrom');
    expect(rules.render).toEqual([]);
  });

  it('предупреждения самого intent не теряются', () => {
    // normalizeIntent предупреждает о пустом intent — это единственный сигнал пользователю
    // о том, что из спеки не извлеклось ничего.
    const empty = normalizeIntent({ formName: 'Пустая', target: 'renderer-json' });
    const { warnings } = formFromIntent(empty);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
