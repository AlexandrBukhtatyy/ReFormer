/**
 * Схема-контроллер и области строк — утечки (`schema-controller`, операторы узлов схемы).
 *
 * Поведение записывает правила узлов в хранилище своей области: корня сборки, подформы (`apply`)
 * или строки массива (`applyEach`). Запись живёт столько же, сколько поведение. Здесь проверяется,
 * что после снятия от неё ничего не остаётся:
 * - снятие формы очищает правила во всех областях сразу; удалённая строка — свою область, не
 *   трогая соседей; повторное снятие чужих записей не задевает;
 * - область удалённой строки уходит сборщику мусора вместе со строкой (области держит слабая
 *   карта по под-модели);
 * - effect'ы рендера (`renderEffect`) живут, пока область смонтирована, и снимаются
 *   размонтированием — счёт effect'ов возвращается к базе;
 * - пересборка поведения на одном контроллере записи не копит.
 * Устройство хранилища и семантика операторов — в `schema-controller.test.ts` и
 * `tests/behaviors/schema-operators.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import { liveEffects } from '../../test-utils/effect-tracker';
import { disposeForm } from '../../test-utils/dispose-form';
import { collectUntilReleased } from '../../test-utils/gc';
import { mountScope } from '../../test-utils/schema-harness';
import { InputStub, SectionStub } from '../../test-utils/stubs';
import {
  createSchemaController,
  unknownSchemaSelectors,
  type SchemaController,
  type SchemaOverrideMaps,
} from '../../../src/form/schema-controller';
import { createForm, type FormBundle } from '../../../src/form/form-bundle';
import { createFormFromModel } from '../../../src/form/create-form';
import {
  apply,
  applyEach,
  defineFormBehavior,
  hideWhen,
  onComponentEvent,
  onMount,
  onUnmount,
  renderEffect,
  type FormBehavior,
} from '../../../src/form/behaviors';
import { arrayOf, createModel, type FormModel } from '../../../src/model/index';
import type { FormSchemaNode } from '../../../src/form/types/schema-node';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

interface Address {
  city: string;
}
interface Row {
  name: string;
}
interface Shape {
  kind: string;
  home: Address;
  rows: Row[];
}

const createShape = (): FormModel<Shape> =>
  createModel<Shape>({
    kind: 'a',
    home: { city: '' },
    rows: arrayOf((): Row => ({ name: '' }), [{ name: 'первая' }, { name: 'вторая' }]),
  });

const shapeSchema = (model: FormModel<Shape>): FormSchemaNode => ({
  selector: 'root',
  component: SectionStub,
  children: [
    { model: model.$.kind, component: InputStub },
    {
      selector: 'home',
      model: model.$.home,
      part: (address: FormModel<Address>): FormSchemaNode => ({
        selector: 'address',
        component: SectionStub,
        children: [{ model: address.$.city, component: InputStub }],
      }),
    },
    {
      selector: 'rows',
      model: model.$.rows,
      item: (row: FormModel<Row>): FormSchemaNode => ({
        selector: 'row',
        component: SectionStub,
        children: [{ model: row.$.name, component: InputStub }],
      }),
    },
  ],
});

/** Строка: по одному правилу каждого вида на узел строки. */
const rowBehavior = defineFormBehavior<Row>(({ model: row, schema }) => {
  hideWhen(schema.node('row'), () => row.name === '');
  onComponentEvent(schema.node('row'), 'onRemove', () => {});
  onMount(schema.node('row'), () => {});
  renderEffect(schema, () => void row.name);
});

/** Подформа адреса: условие скрытия и один хук — второй ветви очистки хуков. */
const addressBehavior = defineFormBehavior<Address>(({ model: address, schema }) => {
  hideWhen(schema.node('address'), () => address.city === '');
  onUnmount(schema.node('address'), () => {});
});

/** Корень: все виды правил на своих узлах и поведения подформы и строк. */
const shapeBehavior = defineFormBehavior<Shape>(({ model, schema }) => {
  hideWhen(schema.node('home'), () => model.kind === 'b');
  onComponentEvent(schema.node('root'), 'onSubmit', () => {});
  onMount(schema.node('root'), () => {});
  onUnmount(schema.node('root'), () => {});
  renderEffect(schema, () => void model.kind);
  apply(model.$.home, addressBehavior);
  applyEach(model.$.rows, rowBehavior);
});

const createShapeForm = (): FormBundle<Shape> =>
  createForm<Shape>({ model: createShape(), schema: shapeSchema, behavior: shapeBehavior });

/**
 * Правила, записанные поведением в область: условия скрытия, эффекты рендера, обработчики
 * (`селектор.событие`) и хуки жизненного цикла (`селектор.хук`).
 */
function rulesOf(maps: SchemaOverrideMaps) {
  return {
    conditions: [...maps.conditionRegistry.keys()],
    effects: maps.effectRegistry.length,
    handlers: [...maps.callbackRegistry].flatMap(([selector, handlers]) =>
      [...handlers.keys()].map((event) => `${selector}.${event}`)
    ),
    lifecycle: [...maps.lifecycleRegistry].flatMap(([selector, hooks]) =>
      Object.keys(hooks).map((hook) => `${selector}.${hook}`)
    ),
  };
}

const NO_RULES = { conditions: [], effects: 0, handlers: [], lifecycle: [] };

const ROOT_RULES = {
  conditions: ['home'],
  effects: 1,
  handlers: ['root.onSubmit'],
  lifecycle: ['root.onMount', 'root.onUnmount'],
};
const ADDRESS_RULES = { ...NO_RULES, conditions: ['address'], lifecycle: ['address.onUnmount'] };
const ROW_RULES = {
  conditions: ['row'],
  effects: 1,
  handlers: ['row.onRemove'],
  lifecycle: ['row.onMount'],
};

const mapsOf = (controller: SchemaController, subModel: object): SchemaOverrideMaps =>
  controller.scopeOf(subModel).__overrideMaps;

describe('schema-controller — снятие правил поведения', () => {
  it('снятие формы очищает правила во всех областях: корень, подформа, строки', () => {
    const bundle = createShapeForm();
    const { model } = bundle;
    const { controller } = bundle.render;
    const scopes = {
      root: model,
      home: model.home,
      first: model.rows.at(0),
      second: model.rows.at(1),
    };
    const rules = () =>
      Object.fromEntries(
        Object.entries(scopes).map(([name, subModel]) => [
          name,
          rulesOf(mapsOf(controller, subModel)),
        ])
      );
    const before = rules();

    disposeForm(bundle.form);

    expect({ before, after: rules() }).toEqual({
      before: { root: ROOT_RULES, home: ADDRESS_RULES, first: ROW_RULES, second: ROW_RULES },
      after: { root: NO_RULES, home: NO_RULES, first: NO_RULES, second: NO_RULES },
    });
  });

  it('удалённая строка очищает свою область сразу; соседи и корень не тронуты, новая строка получает свою', () => {
    const bundle = createShapeForm();
    const { model } = bundle;
    const { controller } = bundle.render;
    const removed = model.rows.at(0);
    const kept = model.rows.at(1);

    model.rows.removeAt(0);
    const afterRemoval = {
      removed: rulesOf(mapsOf(controller, removed)),
      kept: rulesOf(mapsOf(controller, kept)),
      root: rulesOf(mapsOf(controller, model)),
    };
    model.rows.push({ name: 'третья' });

    expect({ afterRemoval, added: rulesOf(mapsOf(controller, model.rows.at(1))) }).toEqual({
      afterRemoval: { removed: NO_RULES, kept: ROW_RULES, root: ROOT_RULES },
      added: ROW_RULES,
    });
    disposeForm(bundle.form);
  });

  it('повторное снятие не трогает правила, записанные после первого другим поведением', () => {
    const model = createShape();
    const controller = createSchemaController();
    const build = (behavior: FormBehavior<Shape>) =>
      createFormFromModel<Shape>({
        model,
        schema: shapeSchema(model),
        schemaController: controller,
        behavior,
      });
    const first = build(shapeBehavior);
    disposeForm(first);
    const second = build(shapeBehavior);

    disposeForm(first);

    expect({
      root: rulesOf(mapsOf(controller, model)),
      row: rulesOf(mapsOf(controller, model.rows.at(0))),
    }).toEqual({ root: ROOT_RULES, row: ROW_RULES });
    disposeForm(second);
  });

  it('20 сборок на одном контроллере: правила не копятся, пустых записей — не больше одной на селектор', () => {
    const model = createShape();
    const controller = createSchemaController();
    const root = mapsOf(controller, model);
    const sizes = new Set<string>();

    for (let cycle = 0; cycle < 20; cycle++) {
      const form = createFormFromModel<Shape>({
        model,
        schema: shapeSchema(model),
        schemaController: controller,
        behavior: shapeBehavior,
      });
      disposeForm(form);
      sizes.add(JSON.stringify({ rules: rulesOf(root), callbackKeys: root.callbackRegistry.size }));
    }

    // Пустых записей не остаётся: снятый последний обработчик убирает и карту селектора.
    expect([...sizes]).toEqual([JSON.stringify({ rules: NO_RULES, callbackKeys: 0 })]);
  });
});

describe('schema-controller — сверка селекторов после снятия', () => {
  /** Сборка, поведение которой пишет правило на узел, которого в схеме нет. */
  const withGhostRule = (rule: FormBehavior<Shape>): FormBundle<Shape> => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = createForm<Shape>({ model: createShape(), schema: shapeSchema, behavior: rule });
    warn.mockRestore();
    return bundle;
  };
  const unknownOf = (bundle: FormBundle<Shape>): string[] =>
    unknownSchemaSelectors(mapsOf(bundle.render.controller, bundle.model), bundle.render.tree!);

  it('снятое условие скрытия и хуки узла из сверки уходят', () => {
    const bundle = withGhostRule(
      defineFormBehavior<Shape>(({ schema }) => {
        hideWhen(schema.node('ghost'), () => true);
        onMount(schema.node('ghost'), () => {});
      })
    );
    const before = unknownOf(bundle);

    disposeForm(bundle.form);

    expect({ before, after: unknownOf(bundle) }).toEqual({ before: ['ghost'], after: [] });
  });

  it('снятый обработчик события селектор в сверке не оставляет [ReFormer-nm2x]', () => {
    const bundle = withGhostRule(
      defineFormBehavior<Shape>(({ schema }) => {
        onComponentEvent(schema.node('ghost'), 'onClick', () => {});
      })
    );

    disposeForm(bundle.form);

    // Снятие последнего обработчика убирает и карту селектора — сверка узел больше не называет.
    expect({
      handlers: rulesOf(mapsOf(bundle.render.controller, bundle.model)).handlers,
      unknown: unknownOf(bundle),
    }).toEqual({ handlers: [], unknown: [] });
  });
});

describe('schema-controller — смонтированные области', () => {
  it("effect'ы рендера живут, пока область смонтирована; размонтирование и снятие возвращают к базе", () => {
    const base = liveEffects();
    const bundle = createShapeForm();
    const { model } = bundle;
    const { controller } = bundle.render;
    const built = liveEffects() - base;

    const root = mountScope(controller.scopeOf(model), ['root', 'home']);
    const row = mountScope(controller.scopeOf(model.rows.at(0)), ['row']);
    const mounted = liveEffects() - base - built;
    root.unmount();
    row.unmount();
    const unmounted = liveEffects() - base - built;
    disposeForm(bundle.form);

    // По одному `renderEffect` на область: корня и строки.
    expect({ mounted, unmounted, disposed: liveEffects() - base }).toEqual({
      mounted: 2,
      unmounted: 0,
      disposed: 0,
    });
  });
});

describe('schema-controller — сборщик мусора', () => {
  /** Слабые ссылки на область первой строки и её хранилище; сильных наружу нет. */
  const trackFirstRowScope = (bundle: FormBundle<Shape>): WeakRef<object>[] => {
    const scope = bundle.render.controller.scopeOf(bundle.model.rows.at(0));
    const maps = scope.__overrideMaps;
    return [scope, maps, maps.conditionRegistry, maps.versionFor('row')].map(
      (target) => new WeakRef(target as object)
    );
  };

  it('область удалённой строки уходит вместе со строкой, пока сборка жива', async () => {
    const bundle = createShapeForm();
    const refs = trackFirstRowScope(bundle);

    bundle.model.rows.removeAt(0);
    await collectUntilReleased(refs);

    expect({
      released: refs.map((ref) => ref.deref() === undefined),
      // Сборка жива, и область оставшейся строки на месте.
      kept: rulesOf(mapsOf(bundle.render.controller, bundle.model.rows.at(0))),
    }).toEqual({ released: [true, true, true, true], kept: ROW_RULES });
    disposeForm(bundle.form);
  });
});
