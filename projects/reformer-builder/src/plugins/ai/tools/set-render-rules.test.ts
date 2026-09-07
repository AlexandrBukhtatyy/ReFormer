/**
 * Инструмент поведения UI.
 *
 * Главное, что здесь проверяется, — что правило НЕ становится молчаливым no-op. До появления
 * управляемых селекторов правило видимости адресовало узел по `selector`, а селектор проставлялся
 * только при экспорте и только секциям, массивам и submit-кнопке. Правило на обычное поле
 * записывалось, отчёт был успешным, а в рантайме `schema.node('…')` не находил ничего — ни ошибки,
 * ни эффекта. Поэтому инструмент обязан проставлять селектор сам и возвращать ОБЕ половины правки:
 * схему с селектором и сайдкар с правилом.
 */

import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { createToolRegistry } from './registry';
import { setRenderRulesTool } from './set-render-rules';
import { emptyRules, type FormRules } from '@/lib/form-model/rules';
import { selectorOf } from '@/lib/form-model/selectors';
import { findByPath } from '@/lib/form-model/query';
import type { ToolContext } from '../model/types';

function schema(): JsonFormSchema {
  return {
    root: {
      component: '$html(div)',
      children: [
        {
          component: '$component(Section)',
          componentProps: { title: 'Доставка' },
          selector: 'dostavka-section',
          children: [],
        },
        {
          value: '$model(pickup)',
          component: '$component(Checkbox)',
          componentProps: { label: 'Самовывоз' },
        },
      ],
    },
  } as unknown as JsonFormSchema;
}

const catalog = builtinEntries();
const reg = createToolRegistry([setRenderRulesTool]);
const ctx = (rules: FormRules = emptyRules()): ToolContext => ({
  draft: schema(),
  base: schema(),
  rules,
  catalog,
  validateForm: validateFormSchema,
});

const SECTION = '/root/children/0';
const FIELD = '/root/children/1';

describe('set_render_rules', () => {
  it('правило на узел с селектором цепляется за существующий адрес', async () => {
    const res = await reg.invoke(
      'set_render_rules',
      { rules: [{ ref: SECTION, kind: 'hideWhen', condition: 'form.pickup.value.value' }] },
      ctx()
    );
    expect(res.ok).toBe(true);
    expect(res.rules?.render).toEqual([
      { kind: 'hideWhen', selector: 'dostavka-section', condition: 'form.pickup.value.value' },
    ]);
  });

  it('узлу БЕЗ селектора он проставляется — иначе правило было бы no-op', async () => {
    const res = await reg.invoke(
      'set_render_rules',
      { rules: [{ ref: FIELD, kind: 'hideWhen', condition: 'false' }] },
      ctx()
    );
    expect(res.ok).toBe(true);
    // Обе половины правки в одном ответе: схема с селектором и правило на него.
    const node = findByPath(res.schema!, ['root', 'children', 1])!;
    expect(selectorOf(node)).toBe('samovyvoz');
    expect(res.rules?.render[0]).toMatchObject({ selector: 'samovyvoz' });
  });

  it('одна правка — один ход истории: возвращаются и схема, и правила', async () => {
    const res = await reg.invoke(
      'set_render_rules',
      { rules: [{ ref: FIELD, kind: 'hideWhen', condition: 'false' }] },
      ctx()
    );
    expect(res.schema).toBeDefined();
    expect(res.rules).toBeDefined();
    expect(res.ops).toHaveLength(1);
  });

  it('повторное правило того же вида на тот же узел ЗАМЕНЯЕТ, а не копится', async () => {
    const first = await reg.invoke(
      'set_render_rules',
      { rules: [{ ref: SECTION, kind: 'hideWhen', condition: 'a' }] },
      ctx()
    );
    const second = await reg.invoke(
      'set_render_rules',
      { rules: [{ ref: SECTION, kind: 'hideWhen', condition: 'b' }] },
      ctx(first.rules!)
    );
    // Два hideWhen на один узел — не «последнее выигрывает», а неопределённость порядка.
    expect(second.rules?.render).toHaveLength(1);
    expect(second.rules?.render[0]).toMatchObject({ condition: 'b' });
  });

  it('правила разных видов на одном узле уживаются', async () => {
    const res = await reg.invoke(
      'set_render_rules',
      {
        rules: [
          { ref: SECTION, kind: 'hideWhen', condition: 'a' },
          { ref: SECTION, kind: 'patchProps', props: { title: 'Иначе' } },
        ],
      },
      ctx()
    );
    expect(res.rules?.render).toHaveLength(2);
  });

  it('неполное правило отвергается с именем недостающего поля', async () => {
    const res = await reg.invoke(
      'set_render_rules',
      { rules: [{ ref: SECTION, kind: 'onEvent', event: 'onClick' }] },
      ctx()
    );
    expect(res.ok).toBe(false);
    expect(res.text).toContain('body');
  });

  it('несуществующий адрес отвергается, а не создаёт правило в никуда', async () => {
    const res = await reg.invoke(
      'set_render_rules',
      { rules: [{ ref: '/root/children/99', kind: 'hideWhen', condition: 'x' }] },
      ctx()
    );
    expect(res.ok).toBe(false);
  });

  it('replace очищает только render, валидацию и поведение не трогает', async () => {
    const before: FormRules = {
      validation: [{ target: 'pickup', rules: ['required'] }],
      behavior: [],
      render: [{ kind: 'hideWhen', selector: 'dostavka-section', condition: 'old' }],
    };
    const res = await reg.invoke(
      'set_render_rules',
      { mode: 'replace', rules: [{ ref: FIELD, kind: 'hideWhen', condition: 'new' }] },
      ctx(before)
    );
    expect(res.rules?.validation).toHaveLength(1);
    expect(res.rules?.render).toHaveLength(1);
    expect(res.rules?.render[0]).toMatchObject({ condition: 'new' });
  });

  it('осиротевшее правило из прошлых ходов называется в ответе', async () => {
    const before: FormRules = {
      ...emptyRules(),
      render: [{ kind: 'hideWhen', selector: 'udalili-etot-uzel', condition: 'x' }],
    };
    const res = await reg.invoke(
      'set_render_rules',
      { rules: [{ ref: SECTION, kind: 'hideWhen', condition: 'y' }] },
      ctx(before)
    );
    expect(res.ok).toBe(true);
    expect(res.text).toContain('udalili-etot-uzel');
  });
});
