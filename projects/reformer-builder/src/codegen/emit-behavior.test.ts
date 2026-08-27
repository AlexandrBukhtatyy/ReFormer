/**
 * Render-правила → `renderer.behavior.ts`.
 *
 * Проверяется не «содержит ли строку», а форма выхода: правило видимости, событие и правка пропсов
 * должны стать РАБОЧИМИ вызовами, а не комментарием. До этой работы `rules.render` (тогда
 * `visibility`) не эмитился вообще: правило записывалось в сайдкар и в код не попадало — ни
 * ошибки, ни эффекта, худший исход из возможных.
 *
 * Компиляция каталога целиком — в `example-compiles.test.ts`; здесь форма отдельных строк.
 */

import { describe, expect, it } from 'vitest';
import { emitBehavior } from './emit-behavior';
import { makeNames } from './naming';
import { emptyRules, type FormRules } from '../model/rules';
import type { SelectorInfo } from './assign-selectors';

const names = makeNames('loan');

function info(overrides: Partial<SelectorInfo> = {}): SelectorInfo {
  return {
    sections: [
      { selector: 'zayavka-section', label: 'Заявка' },
      { selector: 'dostavka-section', label: 'Доставка' },
    ],
    arrays: [],
    submitSelector: 'submit',
    submitEvent: 'onClick',
    injectedSubmit: true,
    ...overrides,
  };
}

const rules = (render: FormRules['render']): FormRules => ({ ...emptyRules(), render });

describe('emitBehavior — правила становятся кодом', () => {
  it('без правил печатает прежний scaffold и глушит неиспользованный hideWhen', () => {
    const out = emitBehavior(names, info());
    expect(out).toContain("// hideWhen(schema.node('zayavka-section')");
    expect(out).toContain("// hideWhen(schema.node('dostavka-section')");
    // `hideWhen` импортирован, но не вызван — без `void` это TS6133 у пользователя.
    expect(out).toContain('void hideWhen;');
  });

  it('hideWhen становится вызовом, а подсказка по этому узлу исчезает', () => {
    const out = emitBehavior(
      names,
      info(),
      rules([
        { kind: 'hideWhen', selector: 'dostavka-section', condition: 'form.pickup.value.value' },
      ])
    );
    expect(out).toContain(
      "hideWhen(schema.node('dostavka-section'), () => form.pickup.value.value);"
    );
    // Подсказка рядом с работающей строкой читалась бы как «одно из двух лишнее».
    expect(out).not.toContain("// hideWhen(schema.node('dostavka-section')");
    // А по узлу без правила — осталась.
    expect(out).toContain("// hideWhen(schema.node('zayavka-section')");
    // Раз hideWhen вызван по-настоящему, глушилка больше не нужна.
    expect(out).not.toContain('void hideWhen;');
  });

  it('onEvent даёт обработчик, аргументы которого не ломают noUnusedParameters', () => {
    const out = emitBehavior(
      names,
      info(),
      rules([{ kind: 'onEvent', selector: 'reset-btn', event: 'onClick', body: 'model.set({});' }])
    );
    expect(out).toContain(
      "onComponentEvent(schema.node('reset-btn'), 'onClick', (...args: unknown[]) => {"
    );
    expect(out).toContain('void args;');
    expect(out).toContain('model.set({});');
  });

  it('async-обработчик помечается async', () => {
    const out = emitBehavior(
      names,
      info(),
      rules([
        { kind: 'onEvent', selector: 'x', event: 'onClick', body: 'await go();', async: true },
      ])
    );
    expect(out).toContain("'onClick', async (...args: unknown[]) => {");
  });

  it('patchProps зовётся методом узла, а не хелпером', () => {
    const out = emitBehavior(
      names,
      info(),
      rules([{ kind: 'patchProps', selector: 'amount', props: { disabled: true, label: 'Сумма' } }])
    );
    // `patchProps` — метод `RenderNodeControl`; standalone-хелпера с таким именем в
    // `@reformer/renderer-react` нет, и вызов в форме хелпера не собрался бы.
    expect(out).toContain(
      'schema.node(\'amount\').patchProps({ disabled: true, label: "Сумма" });'
    );
  });

  it('$expr в пропсах вставляется выражением, остальное — литералом', () => {
    const out = emitBehavior(
      names,
      info(),
      rules([
        {
          kind: 'patchProps',
          selector: 'total',
          props: { value: '$expr(form.total.value.value)', label: 'Итого' },
        },
      ])
    );
    expect(out).toContain('value: form.total.value.value');
    expect(out).toContain('label: "Итого"');
    // Ключевое различие: без него намерение подставить значение неотличимо от строки.
    expect(out).not.toContain('"$expr(');
  });

  it('ключ-неидентификатор экранируется', () => {
    const out = emitBehavior(
      names,
      info(),
      rules([{ kind: 'patchProps', selector: 'x', props: { 'data-testid': 'amount' } }])
    );
    expect(out).toContain('{ "data-testid": "amount" }');
  });
});
