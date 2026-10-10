/**
 * Операторы узлов схемы (`src/form/behaviors/schema-operators.ts`) — глазами рендерера.
 *
 * Оператор только записывает правило в хранилище области, исполняет его рендерер. Поэтому тест
 * смотрит на правило через харнесс рендерера (`test-utils/schema-harness`): скрыт ли узел, какие
 * пропсы получит компонент, куда уйдёт его событие, что вызовется при монтировании и
 * размонтировании. Главное здесь — повторная регистрация на тот же селектор и снятие поведения:
 * снятое правило не должно задеть чужое, а снятое поведение — оставить за собой записи.
 *
 * Два поведения в одной области — две сборки над одной моделью и общим схема-контроллером: так
 * каждое снимается отдельно (`disposeForm`).
 */

import { describe, expect, it, vi } from 'vitest';
import { createModel, type FormModel } from '../../src/model/index';
import { createFormFromModel } from '../../src/form/create-form';
import { createForm } from '../../src/form/form-bundle';
import { createSchemaController, type SchemaController } from '../../src/form/schema-controller';
import {
  defineFormBehavior,
  hideWhen,
  onComponentEvent,
  onInit,
  onMount,
  onUnmount,
  renderEffect,
  type FormBehavior,
} from '../../src/form/behaviors';
import type { FormGroup } from '../../src/form/types/index';
import { disposeForm } from '../test-utils/dispose-form';
import { mountScope } from '../test-utils/schema-harness';
import { InputStub, SectionStub, WizardStub } from '../test-utils/stubs';

interface Loan {
  kind: string;
  amount: number;
}

const createLoan = (): FormModel<Loan> => createModel<Loan>({ kind: 'consumer', amount: 0 });

/** Сборка над общей моделью и контроллером: её поведение пишет в корневую область контроллера. */
const attach = (
  model: FormModel<Loan>,
  controller: SchemaController,
  behavior: FormBehavior<Loan>
): FormGroup<Loan> => createFormFromModel<Loan>({ model, schemaController: controller, behavior });

describe('schema-operators — hideWhen', () => {
  it('узел скрыт, пока условие истинно; условие реактивно', () => {
    const model = createLoan();
    const controller = createSchemaController();
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ model: m, schema }) => {
        hideWhen(schema.node('mortgage'), () => m.kind !== 'mortgage');
      })
    );
    const view = mountScope(controller.scopeOf(model), ['mortgage', 'summary']);

    expect([view.isHidden('mortgage'), view.isHidden('summary')]).toEqual([true, false]);
    model.kind = 'mortgage';
    expect(view.isHidden('mortgage')).toBe(false);
  });

  it('setHidden главнее условия в обе стороны; resetHidden возвращает условие', () => {
    const model = createLoan();
    const controller = createSchemaController();
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ model: m, schema }) => {
        hideWhen(schema.node('mortgage'), () => m.kind !== 'mortgage');
      })
    );
    const scope = controller.scopeOf(model);
    const view = mountScope(scope, ['mortgage']);
    const seen: boolean[] = [];

    scope.node('mortgage').setHidden(false); // условие истинно, узел всё равно виден
    seen.push(view.isHidden('mortgage'));
    model.kind = 'mortgage';
    scope.node('mortgage').setHidden(true); // условие ложно, узел всё равно скрыт
    seen.push(view.isHidden('mortgage'));
    scope.node('mortgage').resetHidden();
    seen.push(view.isHidden('mortgage'));
    model.kind = 'consumer';
    seen.push(view.isHidden('mortgage'));

    expect(seen).toEqual([false, true, false, true]);
  });

  it('два hideWhen на один селектор: действует последний', () => {
    // поведение под вопросом [ReFormer-nm2x]: условия не объединяются по «или» — второе молча заменяет первое,
    // хотя по документации «узел скрыт, пока условие истинно» (docs/llms/35-unified-contract.md).
    const model = createLoan();
    const controller = createSchemaController();
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ model: m, schema }) => {
        hideWhen(schema.node('mortgage'), () => m.kind === 'consumer');
        hideWhen(schema.node('mortgage'), () => m.amount > 100);
      })
    );
    const view = mountScope(controller.scopeOf(model), ['mortgage']);

    expect(view.isHidden('mortgage')).toBe(false); // первое условие истинно, но не действует
    model.amount = 500;
    expect(view.isHidden('mortgage')).toBe(true);
  });

  it('снятие поведения с двумя hideWhen на селектор убирает условие целиком', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const form = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        hideWhen(schema.node('mortgage'), () => true);
        hideWhen(schema.node('mortgage'), () => true);
      })
    );

    disposeForm(form);

    expect(mountScope(controller.scopeOf(model), ['mortgage']).isHidden('mortgage')).toBe(false);
    expect(controller.scopeOf(model).__overrideMaps.conditionRegistry.size).toBe(0);
  });

  it('снятие первого поведения не трогает условие второго на тот же селектор', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const first = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ model: m, schema }) => {
        hideWhen(schema.node('mortgage'), () => m.kind === 'consumer');
      })
    );
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ model: m, schema }) => {
        hideWhen(schema.node('mortgage'), () => m.amount > 100);
      })
    );
    const view = mountScope(controller.scopeOf(model), ['mortgage']);

    disposeForm(first);
    model.amount = 500;

    expect(view.isHidden('mortgage')).toBe(true);
  });

  it('снятие перекрывшего поведения не возвращает условие прежнего', () => {
    // поведение под вопросом [ReFormer-nm2x]: у селектора одна ячейка условия — после снятия второго поведения
    // первое, ещё живое, правило «скрыт, пока consumer» больше не действует.
    const model = createLoan();
    const controller = createSchemaController();
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ model: m, schema }) => {
        hideWhen(schema.node('mortgage'), () => m.kind === 'consumer');
      })
    );
    const second = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        hideWhen(schema.node('mortgage'), () => false);
      })
    );

    disposeForm(second);

    expect(mountScope(controller.scopeOf(model), ['mortgage']).isHidden('mortgage')).toBe(false);
  });
});

describe('schema-operators — onComponentEvent', () => {
  it('обработчик перекрывает одноимённый проп схемы и получает аргументы компонента', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const handler = vi.fn((values: Loan, source: string) => `${source}:${values.amount}`);
    const fromSchema = vi.fn();
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onComponentEvent(schema.node('wizard'), 'onSubmit', handler);
      })
    );
    const view = mountScope(controller.scopeOf(model), [
      { selector: 'wizard', componentProps: { title: 'Заявка', onSubmit: fromSchema } },
    ]);

    const result = view.fire('wizard', 'onSubmit', { kind: 'consumer', amount: 5 }, 'кнопка');

    expect({
      result,
      title: view.propsOf('wizard')?.title,
      schemaCalls: fromSchema.mock.calls,
    }).toEqual({ result: 'кнопка:5', title: 'Заявка', schemaCalls: [] });
  });

  it('обработчики разных событий одного узла живут рядом', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const calls: string[] = [];
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onComponentEvent(schema.node('wizard'), 'onSubmit', () => calls.push('submit'));
        onComponentEvent(schema.node('wizard'), 'onCancel', () => calls.push('cancel'));
      })
    );
    const view = mountScope(controller.scopeOf(model), ['wizard']);

    view.fire('wizard', 'onCancel');
    view.fire('wizard', 'onSubmit');

    expect(calls).toEqual(['cancel', 'submit']);
  });

  it('повторная регистрация события заменяет обработчик; снятие поведения возвращает проп схемы', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const calls: string[] = [];
    const form = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onComponentEvent(schema.node('wizard'), 'onSubmit', () => calls.push('первый'));
        onComponentEvent(schema.node('wizard'), 'onSubmit', () => calls.push('второй'));
      })
    );
    const view = mountScope(controller.scopeOf(model), [
      { selector: 'wizard', componentProps: { onSubmit: () => calls.push('схема') } },
    ]);

    view.fire('wizard', 'onSubmit');
    disposeForm(form);
    view.fire('wizard', 'onSubmit');

    expect(calls).toEqual(['второй', 'схема']);
  });

  it('снятие первого поведения не трогает обработчик второго', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const calls: string[] = [];
    const first = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onComponentEvent(schema.node('wizard'), 'onSubmit', () => calls.push('первый'));
      })
    );
    const second = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onComponentEvent(schema.node('wizard'), 'onSubmit', () => calls.push('второй'));
      })
    );
    const view = mountScope(controller.scopeOf(model), ['wizard']);

    disposeForm(first);
    view.fire('wizard', 'onSubmit');
    disposeForm(second);
    view.fire('wizard', 'onSubmit'); // обработчика нет — компонент зовёт пустой проп

    expect(calls).toEqual(['второй']);
  });

  it('async-обработчик: компонент получает его промис', async () => {
    const model = createLoan();
    const controller = createSchemaController();
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ model: m, schema }) => {
        onComponentEvent(schema.node('wizard'), 'onSubmit', async () => m.get());
      })
    );
    const view = mountScope(controller.scopeOf(model), ['wizard']);
    model.amount = 7;

    await expect(view.fire('wizard', 'onSubmit')).resolves.toEqual({
      kind: 'consumer',
      amount: 7,
    });
  });
});

describe('schema-operators — onMount / onUnmount', () => {
  it('сборка хуков не зовёт; монтирование — onMount, размонтирование — его очистка и onUnmount', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const log: string[] = [];
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onMount(schema.node('boundary'), () => {
          log.push('mount');
          return () => log.push('mount-cleanup');
        });
        onUnmount(schema.node('boundary'), () => log.push('unmount'));
      })
    );

    const afterBuild = [...log];
    const view = mountScope(controller.scopeOf(model), ['boundary']);
    const afterMount = [...log];
    view.unmount();

    expect({ afterBuild, afterMount, afterUnmount: log }).toEqual({
      afterBuild: [],
      afterMount: ['mount'],
      afterUnmount: ['mount', 'mount-cleanup', 'unmount'],
    });
  });

  it('onMount без очистки: при размонтировании зовётся только onUnmount', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const log: string[] = [];
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onMount(schema.node('boundary'), () => void log.push('mount'));
        onUnmount(schema.node('boundary'), () => log.push('unmount'));
      })
    );

    mountScope(controller.scopeOf(model), ['boundary']).unmount();

    expect(log).toEqual(['mount', 'unmount']);
  });

  it('снятие поведения убирает оба хука узла', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const log: string[] = [];
    const form = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onMount(schema.node('boundary'), () => void log.push('mount'));
        onUnmount(schema.node('boundary'), () => log.push('unmount'));
      })
    );

    disposeForm(form);
    mountScope(controller.scopeOf(model), ['boundary']).unmount();

    expect({ log, hooks: controller.scopeOf(model).__overrideMaps.lifecycleRegistry.size }).toEqual(
      {
        log: [],
        hooks: 0,
      }
    );
  });

  it('снятие одного хука оставляет второй, записанный другим поведением', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const log: string[] = [];
    const first = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onMount(schema.node('boundary'), () => void log.push('mount'));
      })
    );
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onUnmount(schema.node('boundary'), () => log.push('unmount'));
      })
    );

    disposeForm(first);
    mountScope(controller.scopeOf(model), ['boundary']).unmount();

    expect(log).toEqual(['unmount']);
  });

  it('повторный onMount заменяет прежний; снятие прежнего не трогает новый', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const log: string[] = [];
    const first = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onMount(schema.node('boundary'), () => void log.push('первый'));
      })
    );
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onMount(schema.node('boundary'), () => void log.push('второй'));
      })
    );

    mountScope(controller.scopeOf(model), ['boundary']).unmount();
    disposeForm(first);
    mountScope(controller.scopeOf(model), ['boundary']).unmount();

    expect(log).toEqual(['второй', 'второй']);
  });

  it('хуки, взятые при монтировании, срабатывают при размонтировании и после снятия поведения', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const log: string[] = [];
    const form = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onUnmount(schema.node('boundary'), () => log.push('unmount'));
      })
    );
    const view = mountScope(controller.scopeOf(model), ['boundary']);

    disposeForm(form); // форма снята раньше, чем узел ушёл со страницы
    view.unmount();

    expect(log).toEqual(['unmount']);
  });
});

describe('schema-operators — onInit', () => {
  it('fn вызывается сразу при сборке, и его patchProps виден первому рендеру', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const order: string[] = [];
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onInit(schema.node('summary'), () => {
          order.push('init');
          schema.node('summary').patchProps({ currency: 'RUB' });
        });
        order.push('после onInit');
      })
    );
    const view = mountScope(controller.scopeOf(model), [
      { selector: 'summary', componentProps: { title: 'Итог' } },
    ]);

    expect({ order, props: view.propsOf('summary') }).toEqual({
      order: ['init', 'после onInit'],
      props: { title: 'Итог', currency: 'RUB' },
    });
  });

  it('onInit хуков узла не записывает: монтирование и снятие поведения его не зовут', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const init = vi.fn();
    const form = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onInit(schema.node('summary'), init);
      })
    );

    mountScope(controller.scopeOf(model), ['summary']).unmount();
    disposeForm(form);

    expect({
      calls: init.mock.calls.length,
      hooks: controller.scopeOf(model).__overrideMaps.lifecycleRegistry.size,
    }).toEqual({ calls: 1, hooks: 0 });
  });
});

describe('schema-operators — renderEffect', () => {
  it('стартует при монтировании, реагирует на сигналы; очистка — перед повтором и при размонтировании', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const log: string[] = [];
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ model: m, schema }) => {
        renderEffect(schema, () => {
          const kind = m.kind;
          log.push(`run:${kind}`);
          return () => log.push(`cleanup:${kind}`);
        });
      })
    );

    model.kind = 'car'; // до монтирования эффект не запущен
    const view = mountScope(controller.scopeOf(model), []);
    model.kind = 'mortgage';
    view.unmount();
    model.kind = 'consumer'; // после размонтирования эффект снят

    expect(log).toEqual(['run:car', 'cleanup:car', 'run:mortgage', 'cleanup:mortgage']);
  });

  it('эффект без очистки и эффект, вернувший не функцию, монтируются одинаково', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const runs = vi.fn();
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ model: m, schema }) => {
        renderEffect(schema, () => void runs(m.amount));
        renderEffect(schema, (() => 42) as unknown as () => void);
      })
    );

    const view = mountScope(controller.scopeOf(model), []);
    model.amount = 3;

    expect(() => view.unmount()).not.toThrow();
    expect(runs.mock.calls).toEqual([[0], [3]]);
  });

  it('повторная отписка поведения не снимает чужой эффект', () => {
    // `splice(-1, 1)` без проверки индекса удалил бы последний эффект области — чужой.
    const model = createLoan();
    const controller = createSchemaController();
    const form = createFormFromModel<Loan>({ model });
    const own = defineFormBehavior<Loan>(({ schema }) => {
      renderEffect(schema, () => {});
    });
    const foreignRuns = vi.fn();
    const foreign = defineFormBehavior<Loan>(({ schema }) => {
      renderEffect(schema, foreignRuns);
    });
    const stopOwn = own.__run(model, form, controller);
    foreign.__run(model, form, controller);

    stopOwn();
    stopOwn();
    mountScope(controller.scopeOf(model), []).unmount();

    expect(foreignRuns).toHaveBeenCalledTimes(1);
  });
});

describe('schema-operators — управление узлом', () => {
  it('patchProps накапливается поверх componentProps; resetProps убирает подмешанное', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const scope = controller.scopeOf(model);
    const view = mountScope(scope, [
      { selector: 'summary', componentProps: { title: 'Итог', currency: 'USD' } },
    ]);
    const seen: Array<Readonly<Record<string, unknown>> | undefined> = [];

    scope.node('summary').patchProps({ currency: 'RUB' }).patchProps({ hint: 'с НДС' });
    seen.push(view.propsOf('summary'));
    scope.node('summary').resetProps();
    seen.push(view.propsOf('summary'));

    expect(seen).toEqual([
      { title: 'Итог', currency: 'RUB', hint: 'с НДС' },
      { title: 'Итог', currency: 'USD' },
    ]);
  });

  it('скрытый узел компонент не рисует: пропсов нет, событию неоткуда прийти', () => {
    const model = createLoan();
    const controller = createSchemaController();
    const submit = vi.fn();
    attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        onComponentEvent(schema.node('wizard'), 'onSubmit', submit);
        schema.node('wizard').setHidden(true);
      })
    );
    const view = mountScope(controller.scopeOf(model), ['wizard']);

    expect(view.propsOf('wizard')).toBeUndefined();
    expect(() => view.fire('wizard', 'onSubmit')).toThrow(/скрыт/);
    expect(submit).not.toHaveBeenCalled();
  });

  it('patchProps и setHidden императивны: снятие поведения их не откатывает', () => {
    // поведение под вопросом [ReFormer-nm2x]: правила операторов снимаются вместе с поведением, а то, что оно
    // сделало через schema.node(…), остаётся — новое поведение получит узел скрытым.
    const model = createLoan();
    const controller = createSchemaController();
    const form = attach(
      model,
      controller,
      defineFormBehavior<Loan>(({ schema }) => {
        schema.node('summary').setHidden(true).patchProps({ currency: 'RUB' });
      })
    );

    disposeForm(form);
    const maps = controller.scopeOf(model).__overrideMaps;

    expect({
      hidden: maps.hiddenOverrides.get('summary'),
      props: maps.propsOverrides.get('summary'),
    }).toEqual({ hidden: true, props: { currency: 'RUB' } });
  });

  it('сборка createForm: render.node и schema корневого поведения — одна область', () => {
    const submit = vi.fn();
    const bundle = createForm<Loan>({
      initial: { kind: 'consumer', amount: 0 },
      schema: (model) => ({
        selector: 'wizard',
        component: WizardStub,
        children: [
          {
            selector: 'mortgage',
            component: SectionStub,
            children: [{ model: model.$.amount, component: InputStub }],
          },
        ],
      }),
      behavior: defineFormBehavior<Loan>(({ model: m, schema }) => {
        hideWhen(schema.node('mortgage'), () => m.kind !== 'mortgage');
        onComponentEvent(schema.node('wizard'), 'onSubmit', submit);
      }),
    });
    const view = mountScope(bundle.render.controller.scopeOf(bundle.model), ['wizard', 'mortgage']);

    bundle.render.node('mortgage').setHidden(false);
    view.fire('wizard', 'onSubmit', 'payload');

    expect({ hidden: view.isHidden('mortgage'), submit: submit.mock.calls }).toEqual({
      hidden: false,
      submit: [['payload']],
    });
  });
});
