/**
 * Сборка бандла рантайм-поверхности.
 *
 * Тест возможен в node потому, что сборка формы DOM не трогает: `createForm` создаёт модель,
 * дерево узлов и form-node'ы, а рисует их уже рендерер. Это же и делает проверку ценной — она ловит ровно
 * тот отказ, из-за которого в v1 форма рисовалась пустой: не собрались form-node'ы.
 *
 * @module plugins/reformer/render/runtime/build.test
 */

import { describe, expect, it } from 'vitest';
import { onComponentEvent, hideWhen } from '@reformer/core/behaviors';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { sampleSchema } from '../../../core/testing';
import { ensureNodeIds, newNodeId } from '../../../core/form-model';
import { toDescriptor } from '@reformer/builder-plugin-api';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { NODE_CLASS_PREFIX } from '../schema/node-token';
import { deepMerge } from '../../../core/form-fixture';
import { buildRuntimeBundle, type BehaviorRules, type Shape, type WireSubmit } from './build';

const DESCRIPTOR = toDescriptor({ version: '1.0', components: [] });

function bundleOf(schema: JsonFormSchema, extra: Record<string, unknown> = {}) {
  return buildRuntimeBundle({
    schema,
    catalog: [],
    descriptor: DESCRIPTOR,
    namespace: {},
    mock: null,
    ...extra,
  });
}

describe('buildRuntimeBundle', () => {
  it('собирает форму и модель по схеме', () => {
    const bundle = bundleOf(sampleSchema());
    expect(bundle.problems).toEqual([]);
    expect(bundle.form).not.toBeNull();
    expect(bundle.form?.model.get()).toMatchObject({ loanType: '', properties: [] });
  });

  it('в рендерер уходит АННОТИРОВАННАЯ копия, а исходная схема не тронута', () => {
    const schema = ensureNodeIds(sampleSchema(), newNodeId);
    const before = JSON.stringify(schema);
    const bundle = bundleOf(schema);
    expect(JSON.stringify(bundle.schema)).toContain(NODE_CLASS_PREFIX);
    expect(JSON.stringify(schema)).toBe(before);
  });

  it('начальные значения модуля перекрывают синтезированный мок', () => {
    const bundle = bundleOf(sampleSchema(), { initialOverride: { loanType: 'ипотека' } });
    expect(bundle.form?.model.get()).toMatchObject({ loanType: 'ипотека' });
  });

  it('введённые значения переносятся поверх мока и начальных значений модуля', () => {
    const bundle = bundleOf(sampleSchema(), {
      initialOverride: { loanType: 'ипотека' },
      carry: { loanType: 'автокредит' },
    });
    // Введённое человеком старше и мока, и объявленных начальных значений.
    expect(bundle.form?.model.get()).toMatchObject({ loanType: 'автокредит' });
  });

  it('значения модуля от прежней схемы форму не роняют и лишних путей не заводят', () => {
    // Код печатали, когда `loanType` был группой, а в форме было поле `legacy`; схему с тех пор
    // поправили, код — нет. Форма данных — у живой схемы.
    const bundle = bundleOf(sampleSchema(), {
      initialOverride: { loanType: { code: 'ипотека' }, loanAmount: 500000, legacy: 'x' },
    });
    expect(bundle.problems).toEqual([]);
    const model = bundle.form?.model.get() as Record<string, unknown>;
    // Группа на месте листа не легла, число на месте числа — легло.
    expect(model).toMatchObject({ loanType: '', loanAmount: 500000 });
    expect(Object.hasOwn(model, 'legacy')).toBe(false);
  });

  it('перенос не создаёт путей, которых в схеме нет', () => {
    const bundle = bundleOf(sampleSchema(), { carry: { loanType: 'авто', сгинувшее: 'x' } });
    const model = bundle.form?.model.get() as Record<string, unknown>;
    expect(model).toMatchObject({ loanType: 'авто' });
    expect(Object.hasOwn(model, 'сгинувшее')).toBe(false);
  });

  it('форму собирает единая сборка: в бандле модель, ноды формы и дерево для рендерера', () => {
    const bundle = bundleOf(sampleSchema());
    expect(bundle.form?.form.getValue()).toMatchObject({ loanType: '' });
    expect(bundle.form?.render.tree).toBeDefined();
    // Шаги визарда — дети корня: дерево сборки строит их узлами, а не пропом.
    expect(bundle.form?.render.tree?.root).toBeDefined();
  });

  it('документ прежнего формата сборка не принимает — находка, а не пустая форма', () => {
    // На поверхность такой документ не попадает (его переводит `usePreviewSchema`), но если
    // попадёт, отказ обязан быть объяснён словами.
    const legacy = {
      version: '1.0',
      root: { component: '$component(Box)', children: [{ value: '$model(name)' }] },
    } as unknown as JsonFormSchema;
    const bundle = bundleOf(legacy);
    expect(bundle.form).toBeNull();
    expect(bundle.problems[0]?.message).toMatch(/migrateJsonSchema/);
  });

  it('правила узлов прежнего слоя применяются в setup сборки', () => {
    const seen: { form?: unknown; model?: unknown; hasNode?: boolean } = {};
    const bundle = bundleOf(sampleSchema(), {
      renderBehavior: (form: unknown, model: unknown) => {
        seen.form = form;
        seen.model = model;
        return (schema: { node?: unknown }) => {
          seen.hasNode = typeof schema.node === 'function';
        };
      },
    });
    expect(bundle.problems).toEqual([]);
    expect(seen.form).toBe(bundle.form?.form);
    expect(seen.model).toBe(bundle.form?.model);
    expect(seen.hasNode).toBe(true);
  });

  it('отказ прежнего слоя форму не роняет — он становится находкой', () => {
    const bundle = bundleOf(sampleSchema(), {
      renderBehavior: () => {
        throw new Error('старый слой сломан');
      },
    });
    expect(bundle.form).not.toBeNull();
    expect(bundle.problems).toEqual([
      { file: 'form.render.ts', phase: 'evaluate', message: 'старый слой сломан' },
    ]);
  });

  it('битая схема — находка, а не исключение', () => {
    const bundle = bundleOf({ version: '1.0' } as unknown as JsonFormSchema);
    expect(bundle.form).toBeNull();
    expect(bundle.problems).toHaveLength(1);
  });

  it('находка прежнего слоя называется файлом, из которого он взят', () => {
    const bundle = bundleOf(sampleSchema(), {
      renderBehavior: () => {
        throw new Error('старый слой сломан');
      },
      files: { renderBehavior: 'renderer.behavior.ts' },
    });
    expect(bundle.problems).toEqual([
      { file: 'renderer.behavior.ts', phase: 'evaluate', message: 'старый слой сломан' },
    ]);
  });

  it('реестр формы, который не сложился с билдерским, — находка с именем файла реестра', () => {
    const broken = bundleOf(sampleSchema(), { extraRegistry: null });
    expect(broken.form).not.toBeNull();
    // Файл не назван — берётся имя раскладки «папки по ролям», а не прежнее `registry.ts`.
    expect(broken.problems).toEqual([
      expect.objectContaining({ file: 'schema/registry.ts', phase: 'evaluate' }),
    ]);

    const named = bundleOf(sampleSchema(), {
      extraRegistry: null,
      files: { registry: 'registry.ts' },
    });
    expect(named.problems[0]?.file).toBe('registry.ts');
  });
});

/** Простая форма с узлом отправки — селектор тот же, что проставляет кодоген. */
function submitSchema(): JsonFormSchema {
  return {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      selector: 'form-root',
      children: [
        { model: '$model(name)', component: '$component(Input)' },
        { component: '$component(Button)', selector: 'submit' },
      ],
    },
  } as unknown as JsonFormSchema;
}

describe('buildRuntimeBundle — поведение модуля двумя половинами', () => {
  it('сначала правила, затем отправка — в одном поведении, над одной областью', () => {
    const order: string[] = [];
    const scopes: unknown[] = [];
    const rules: BehaviorRules = (scope) => {
      order.push('rules');
      scopes.push(scope.model);
      hideWhen(scope.schema.node('form-root'), () => false);
    };
    const wireSubmit: WireSubmit = (scope) => {
      order.push('submit');
      scopes.push(scope.model);
      onComponentEvent(scope.schema.node('submit'), 'onClick', () => undefined);
    };

    const bundle = bundleOf(submitSchema(), { moduleBehavior: { rules, wireSubmit } });

    expect(bundle.problems).toEqual([]);
    expect(order).toEqual(['rules', 'submit']);
    expect(scopes[0]).toBe(bundle.form?.model);
    expect(scopes[1]).toBe(bundle.form?.model);
  });

  it('итог отправки приходит туда, куда его велели сообщить', () => {
    const seen: [string, boolean][] = [];
    let report: ((message: string, ok: boolean) => void) | undefined;
    const wireSubmit: WireSubmit = (scope, { onResult }) => {
      // Так делает `application/submit.ts`: обработчик узла отправки зовёт `onResult`.
      report = onResult;
      onComponentEvent(scope.schema.node('submit'), 'onClick', () => {
        onResult?.('Форма отправлена', true);
      });
    };

    const bundle = bundleOf(submitSchema(), {
      moduleBehavior: {
        rules: () => undefined,
        wireSubmit,
        onResult: (message: string, ok: boolean) => {
          seen.push([message, ok]);
        },
      },
    });
    report?.('Проверьте заполнение формы', false);

    expect(bundle.problems).toEqual([]);
    expect(seen).toEqual([['Проверьте заполнение формы', false]]);
  });

  it('половины модуля старше готового поведения: иначе правила применились бы дважды', () => {
    let ready = 0;
    let halves = 0;
    const bundle = bundleOf(submitSchema(), {
      behavior: {
        __run: () => {
          ready += 1;
          return () => undefined;
        },
      },
      moduleBehavior: {
        rules: () => {
          halves += 1;
        },
        wireSubmit: () => undefined,
      },
    });
    expect(bundle.form).not.toBeNull();
    expect([ready, halves]).toEqual([0, 1]);
  });

  it('отказ отправки форму не роняет — находка с именем её файла, правила при этом работают', () => {
    let applied = false;
    const bundle = bundleOf(submitSchema(), {
      moduleBehavior: {
        rules: () => {
          applied = true;
        },
        wireSubmit: () => {
          throw new Error('submitForm is not defined');
        },
      },
      files: { submit: 'application/submit.ts' },
    });

    expect(bundle.form).not.toBeNull();
    expect(applied).toBe(true);
    expect(bundle.problems).toEqual([
      { file: 'application/submit.ts', phase: 'evaluate', message: 'submitForm is not defined' },
    ]);
  });

  it('узла отправки нет в живой схеме — форма собирается, а находка называет узел и файл', () => {
    // Обращение к несуществующему узлу ничего не бросает: правило записывается и молчит. Кнопка
    // есть, нажатие ничего не делает — и узнать об этом больше неоткуда.
    const wireSubmit: WireSubmit = (scope) => {
      onComponentEvent(scope.schema.node('wizard'), 'onSubmit', () => undefined);
    };
    const bundle = bundleOf(submitSchema(), {
      moduleBehavior: { rules: () => undefined, wireSubmit },
    });

    expect(bundle.form).not.toBeNull();
    expect(bundle.problems).toEqual([
      {
        file: 'application/submit.ts',
        phase: 'render',
        message: expect.stringContaining('«wizard»') as string,
      },
    ]);
  });

  it('находка — только про узлы ОТПРАВКИ: правило поведения по чужому селектору её не даёт', () => {
    const rules: BehaviorRules = (scope) => {
      hideWhen(scope.schema.node('net-takogo-uzla'), () => false);
    };
    const wireSubmit: WireSubmit = (scope) => {
      onComponentEvent(scope.schema.node('submit'), 'onClick', () => undefined);
    };
    expect(bundleOf(submitSchema(), { moduleBehavior: { rules, wireSubmit } }).problems).toEqual(
      []
    );
  });
});

describe('buildRuntimeBundle — поток шагов', () => {
  /** Визард из двух шагов; селекторы шагов — идентификаторы шагов потока. */
  function wizardSchema(): JsonFormSchema {
    return {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Wizard)',
        selector: 'wizard',
        children: [
          {
            component: '$component(Step)',
            selector: 'dannye-section',
            children: [{ model: '$model(name)', component: '$component(Input)' }],
          },
          {
            component: '$component(Step)',
            selector: 'kontakty-section',
            children: [{ model: '$model(email)', component: '$component(Input)' }],
          },
        ],
      },
    } as unknown as JsonFormSchema;
  }

  const stepRules = defineValidation<Shape>(({ model }) => {
    validate(model.$.name as never, [required()]);
  });
  const flow = { steps: [{ id: 'dannye-section', rules: stepRules }, { id: 'kontakty-section' }] };

  it('поток доходит до сборки: «Далее» проверяет правила текущего шага', async () => {
    const bundle = bundleOf(wizardSchema(), { flow, validation: {} });
    const steps = bundle.form?.flow;
    if (steps === undefined) throw new Error('поток шагов не дошёл до сборки');

    // Пустой обязательный шаг не проходит — и поле помечено тронутым, иначе кит не покажет ошибку.
    await expect(steps.next()).resolves.toMatchObject({ status: 'stayed', reason: 'invalid' });
    expect(steps.current.value).toBe('dannye-section');

    bundle.form?.form.name.setValue('Аня');
    await expect(steps.next()).resolves.toMatchObject({ status: 'moved', to: 'kontakty-section' });
  });

  it('без потока шагов сборка его и не заводит: визард строит позиционный сам', () => {
    expect(bundleOf(wizardSchema()).form?.flow).toBeUndefined();
  });

  it('полный набор правил отправки собирается из правил шагов потока', async () => {
    const bundle = bundleOf(wizardSchema(), { flow, validation: {} });
    await expect(bundle.form?.validate()).resolves.toMatchObject({ status: 'invalid' });
  });
});

describe('deepMerge', () => {
  it('объекты сливаются вглубь, скаляры перекрываются', () => {
    expect(deepMerge({ a: { b: 1, c: 2 } }, { a: { c: 3 } })).toEqual({ a: { b: 1, c: 3 } });
  });
});
