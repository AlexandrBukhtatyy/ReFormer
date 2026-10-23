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
import type { CatalogEntry } from '../../../core/catalog';
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

  it('введённое в поле с начальным null переживает пересборку после правки схемы', () => {
    // Число без нижней границы, дата, мультивыбор и файлы синтез заводит `null`; комбобоксу `null`
    // объявляет модуль формы. По паре «`null` и введённое» род не понять — вид поля даёт схема.
    const fields = (label: string): JsonFormSchema =>
      ({
        format: 2,
        root: {
          component: '$component(Box)',
          children: [
            { model: '$model(title)', component: '$component(Input)', componentProps: { label } },
            { model: '$model(age)', component: '$component(InputNumber)' },
            { model: '$model(birthDate)', component: '$component(DatePicker)' },
            { model: '$model(skills)', component: '$component(ComboboxMulti)' },
            { model: '$model(documents)', component: '$component(FileUploadDropzone)' },
            {
              model: '$model(position)',
              component: '$component(Combobox)',
              componentProps: { options: [] },
            },
          ],
        },
      }) as unknown as JsonFormSchema;
    const declared = { position: null };

    const first = bundleOf(fields('Заголовок'), { initialOverride: declared });
    expect(first.form?.model.get()).toEqual({
      title: '',
      age: null,
      birthDate: null,
      skills: null,
      documents: null,
      position: null,
    });

    // Человек заполнил форму…
    const picked = new Date(2020, 0, 1);
    const scan = { id: 'f1', name: 'паспорт.pdf' };
    first.form?.model.patch({
      age: 5,
      birthDate: picked,
      skills: ['react', 'sql'],
      documents: [scan],
      position: 'analyst',
    });

    // …и поправил в схеме подпись соседнего поля: форма пересобирается.
    const second = bundleOf(fields('Название'), {
      initialOverride: declared,
      carry: first.form?.model.get(),
    });
    expect(second.problems).toEqual([]);
    expect(second.form?.model.get()).toEqual({
      title: '',
      age: 5,
      birthDate: picked,
      skills: ['react', 'sql'],
      documents: [scan],
      position: 'analyst',
    });
    // Список на месте листа поле не ломает: нода мультивыбора привязана к сигналу списка.
    expect(second.form?.form.skills.value.value).toEqual(['react', 'sql']);
  });

  it('вид поля чужого кита — из его каталога: тот же мок, что у экспорта, и тот же перенос', () => {
    // `CheckboxGroup` в наборах имён синтеза нет: что он отдаёт список строк, говорит только
    // каталог кита. Без него превью завело бы `''`, а экспорт — `null`.
    const catalog = [
      {
        name: 'CheckboxGroup',
        role: 'field',
        propsSchema: {
          'x-runtimeProps': {
            value: { group: 'Control', type: 'string[] | null', description: 'Выбранное.' },
          },
        },
        makeNode: () => ({ model: '$model(days)', component: '$component(CheckboxGroup)' }),
      },
    ] as unknown as readonly CatalogEntry[];
    const schema = (label: string): JsonFormSchema =>
      ({
        format: 2,
        root: {
          component: '$component(Box)',
          children: [
            { model: '$model(title)', component: '$component(Input)', componentProps: { label } },
            { model: '$model(days)', component: '$component(CheckboxGroup)' },
          ],
        },
      }) as unknown as JsonFormSchema;

    const first = bundleOf(schema('Заголовок'), { catalog });
    expect(first.form?.model.get()).toEqual({ title: '', days: null });
    first.form?.model.patch({ days: ['mon', 'tue'] });

    // Правка подписи соседнего поля: выбранное переживает пересборку — вид поля из каталога.
    const second = bundleOf(schema('Название'), { catalog, carry: first.form?.model.get() });
    expect(second.form?.model.get()).toEqual({ title: '', days: ['mon', 'tue'] });
  });

  it('поле переделали — прежнее значение другого вида не переносится', () => {
    const schema = (component: string): JsonFormSchema =>
      ({
        format: 2,
        root: {
          component: '$component(Box)',
          children: [{ model: '$model(amount)', component: `$component(${component})` }],
        },
      }) as unknown as JsonFormSchema;

    const typed = bundleOf(schema('Input'));
    typed.form?.model.patch({ amount: 'много' });
    // Строку переделали в число: «много» — уже не значение, а мусор.
    const rebuilt = bundleOf(schema('InputNumber'), { carry: typed.form?.model.get() });
    expect(rebuilt.form?.model.get()).toEqual({ amount: null });
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

  it('битая схема — находка, а не исключение', () => {
    const bundle = bundleOf({ version: '1.0' } as unknown as JsonFormSchema);
    expect(bundle.form).toBeNull();
    expect(bundle.problems).toHaveLength(1);
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

describe('несобранные шаги', () => {
  it('ссылка на файл шага — находка с файлами, а не внутренняя ошибка рендерера', () => {
    // Такую схему превью получает, когда сборка документа шаг не подставила.
    const schema = {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Wizard)',
        children: [
          { $ref: './steps/personal/form.schema.json' },
          { $ref: './steps/extra/form.schema.json' },
        ],
      },
    } as unknown as JsonFormSchema;

    const bundle = bundleOf(schema);

    expect(bundle.form).toBeNull();
    expect(bundle.problems).toHaveLength(1);
    expect(bundle.problems[0].message).toMatch(/^шаги мастера не собраны/);
    expect(bundle.problems[0].message).toContain('«./steps/personal/form.schema.json»');
    expect(bundle.problems[0].message).toContain('«./steps/extra/form.schema.json»');
    expect(bundle.problems[0].message).not.toContain('composeJsonFormSchema');
  });
});
