/**
 * `options` записи `behavior`: сборка печатает их не у всех видов, и у остальных они пропадали
 * молча — в модуле `form_build` и в документе билдера (ReFormer-11oe.11). Чтение intent называет
 * такие `options` проблемой, а список видов, которые их держат, сверяется со сборкой.
 */

import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { buildBehaviorTs } from '../src/core/generate/builders.js';
import {
  normalizeIntent,
  readIntent,
  type BehaviorIntent,
  type IntentReading,
} from '../src/core/generate/form-intent.js';
import {
  BEHAVIOR_KINDS_WITH_OPTIONS,
  MODEL_BEHAVIOR_KINDS,
} from '../src/core/generate/operator-catalog.js';

const read = (behavior: unknown[]): IntentReading =>
  readIntent(
    {
      formName: 'Order',
      target: 'renderer-react',
      fields: [
        { name: 'price', type: 'number', component: 'Input', label: 'Цена' },
        { name: 'quantity', type: 'number', component: 'Input', label: 'Количество' },
        { name: 'total', type: 'number', component: 'Input', label: 'Итого' },
      ],
      behavior,
    },
    { uiKit: CATALOGS.uiKit, uiKitProps: CATALOGS.uiKitProps }
  );

const computeFrom = {
  kind: 'computeFrom',
  target: 'total',
  sources: ['price', 'quantity'],
  expr: 'price * quantity',
};

describe('readIntent: options у вида, который их не печатает', () => {
  it('computeFrom с debounce — проблема: параметр был бы потерян', () => {
    const { problems } = read([{ ...computeFrom, options: { debounce: 300 } }]);
    expect(problems).toEqual([
      expect.objectContaining({
        code: 'unknown-key',
        at: 'behavior[0].options',
        message: expect.stringContaining('`debounce` would be lost'),
        expected: expect.stringContaining('"when"'),
      }),
    ]);
  });

  it('when внутри options у вычисления — его условие, без проблемы', () => {
    const reading = read([{ ...computeFrom, options: { when: 'model.price > 0' } }]);
    expect(reading.problems).toEqual([]);
    expect(reading.intent.behavior[0]).toMatchObject({ when: 'model.price > 0' });
    expect(reading.intent.behavior[0]).not.toHaveProperty('options');
  });

  it('when и чужой ключ — проблема называет только чужой', () => {
    const { problems } = read([
      { ...computeFrom, options: { when: 'model.price > 0', immediate: true } },
    ]);
    expect(problems.map((problem) => problem.message)).toEqual([
      expect.stringMatching(/takes no options besides `when` — `immediate` would be lost/),
    ]);
  });

  it('transformValue с options — проблема с перечнем видов, которые их держат', () => {
    const { problems } = read([
      { kind: 'transformValue', target: 'total', expr: 'Math.round(value)', options: { x: 1 } },
    ]);
    expect(problems).toEqual([
      expect.objectContaining({
        code: 'unknown-key',
        expected: `drop \`options\`; they are kept by ${BEHAVIOR_KINDS_WITH_OPTIONS.join(', ')}`,
      }),
    ]);
  });

  it('проблема options не прячет другие ошибки той же записи', () => {
    const { problems } = read([{ ...computeFrom, options: { debounce: 300 }, lable: 'x' }]);
    expect(problems.map((problem) => problem.at)).toEqual([
      'behavior[0].options',
      'behavior[0].lable',
    ]);
  });

  it('пустые options и options у вида, который их держит, — без проблемы', () => {
    expect(read([{ ...computeFrom, options: {} }]).problems).toEqual([]);
    const reading = read([
      { kind: 'syncFields', target: 'total', sources: ['price'], options: { initial: 'source' } },
    ]);
    expect(reading.problems).toEqual([]);
    expect(reading.intent.behavior[0]).toMatchObject({ options: { initial: 'source' } });
  });
});

describe('сборка печатает options ровно у видов из BEHAVIOR_KINDS_WITH_OPTIONS', () => {
  const base = normalizeIntent({
    formName: 'Order',
    target: 'renderer-react',
    fields: [
      { name: 'price', type: 'number', component: 'Input' },
      { name: 'total', type: 'number', component: 'Input' },
    ],
    arrays: [
      {
        name: 'items',
        itemInterfaceName: 'OrderItem',
        itemFields: [{ name: 'main', type: 'boolean', component: 'Checkbox' }],
        initialValue: [],
      },
    ],
  });

  const targets: Record<string, Partial<BehaviorIntent>> = {
    exclusiveFlag: { target: 'items.main', each: 'items' },
    aggregateInto: { target: 'items', expr: '[]' },
  };

  it.each(MODEL_BEHAVIOR_KINDS)('%s', (kind) => {
    const row = {
      kind,
      target: 'total',
      sources: ['price'],
      expr: 'model.price',
      ...targets[kind],
      options: { probe: 1 },
    } as BehaviorIntent;
    const ts = buildBehaviorTs({ ...base, behavior: [row] });
    const printed = ts.includes('"probe":1') || ts.includes('probe: 1');
    expect(printed).toBe((BEHAVIOR_KINDS_WITH_OPTIONS as readonly string[]).includes(kind));
  });
});
