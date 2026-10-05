/**
 * Схема в области поведения: `defineFormBehavior(({ model, form, schema }) => …)`.
 *
 * `schema.node(selector)` адресует узлы СВОЕЙ области — корня сборки, подформы (`apply`) или
 * строки массива (`applyEach`). Операторы узлов только записывают правило в схему-контроллер
 * сборки; исполняет его рендерер.
 */

import { describe, it, expect, vi } from 'vitest';
import { createModel, type FormModel } from '../../src/model/index';
import { createFormFromModel } from '../../src/form/create-form';
import {
  createSchemaController,
  createSchemaScope,
  type SchemaScope,
} from '../../src/form/schema-controller';
import {
  apply,
  applyEach,
  defineFormBehavior,
  getScope,
  hideWhen,
  onComponentEvent,
  onInit,
  onMount,
  onUnmount,
  renderEffect,
} from '../../src/form/behaviors';

interface Address {
  city: string;
  house: string;
}
interface Row {
  name: string;
}
interface Shape {
  kind: string;
  registration: Address;
  residence: Address;
  rows: Row[];
}

const createShape = () =>
  createModel<Shape>({
    kind: 'a',
    registration: { city: '', house: '' },
    residence: { city: '', house: '' },
    rows: [],
  });

const rowItem = (model: FormModel<Row>) => ({ children: [{ model: model.$.name }] });
const shapeSchema = (model: FormModel<Shape>) => ({
  children: [{ model: model.$.kind }, { model: model.$.rows, item: rowItem }],
});

describe('Область поведения: schema', () => {
  it('корневое поведение получает схему корневой области контроллера сборки', () => {
    const model = createShape();
    const controller = createSchemaController();
    let seen: SchemaScope | undefined;

    createFormFromModel<Shape>({
      model,
      schema: shapeSchema(model),
      schemaController: controller,
      behavior: defineFormBehavior<Shape>(({ schema }) => {
        seen = schema;
        hideWhen(schema.node('mortgage'), () => model.kind !== 'mortgage');
      }),
    });

    const root = controller.scopeOf(model);
    expect(seen).toBe(root);
    expect(root.__overrideMaps.conditionRegistry.get('mortgage')?.()).toBe(true);
    model.kind = 'mortgage';
    expect(root.__overrideMaps.conditionRegistry.get('mortgage')?.()).toBe(false);
  });

  it('getScope() отдаёт ту же схему, что и аргумент', () => {
    const model = createShape();
    let fromArgument: SchemaScope | undefined;
    let fromScope: SchemaScope | undefined;

    createFormFromModel<Shape>({
      model,
      behavior: defineFormBehavior<Shape>(({ schema }) => {
        fromArgument = schema;
        fromScope = getScope<Shape>().schema;
      }),
    });

    expect(fromScope).toBe(fromArgument);
  });

  it('без контроллера сборки схема есть, правила просто никто не читает', () => {
    const model = createShape();

    expect(() =>
      createFormFromModel<Shape>({
        model,
        behavior: defineFormBehavior<Shape>(({ schema }) => {
          hideWhen(schema.node('anything'), () => true);
          schema.node('anything').patchProps({ title: 'x' });
        }),
      })
    ).not.toThrow();
  });

  it('две сборки на одной модели записей не делят', () => {
    const model = createShape();
    const behavior = defineFormBehavior<Shape>(({ schema }) => {
      hideWhen(schema.node('block'), () => true);
    });
    const first = createSchemaController();
    const second = createSchemaController();

    createFormFromModel<Shape>({ model, behavior, schemaController: first });

    expect(first.scopeOf(model).__overrideMaps.conditionRegistry.has('block')).toBe(true);
    expect(second.scopeOf(model).__overrideMaps.conditionRegistry.has('block')).toBe(false);
  });
});

describe('Области подформы и строки массива', () => {
  const addressBehavior = defineFormBehavior<Address>(({ model, schema }) => {
    hideWhen(schema.node('apartment'), () => model.house === '');
  });

  it('`apply`: под-схема пишет в область своей группы, корень её узлов не видит', () => {
    const model = createShape();
    const controller = createSchemaController();

    createFormFromModel<Shape>({
      model,
      schemaController: controller,
      behavior: defineFormBehavior<Shape>(({ model }) => {
        apply([model.$.registration, model.$.residence], addressBehavior);
      }),
    });

    const registration = controller.scopeOf(model.registration).__overrideMaps.conditionRegistry;
    const residence = controller.scopeOf(model.residence).__overrideMaps.conditionRegistry;
    expect(controller.scopeOf(model).__overrideMaps.conditionRegistry.size).toBe(0);
    // Одна часть стоит дважды — условия независимы.
    model.registration.house = '5';
    expect(registration.get('apartment')?.()).toBe(false);
    expect(residence.get('apartment')?.()).toBe(true);
  });

  it('`applyEach`: у каждой строки своя область; удаление строки снимает её правила', () => {
    const model = createShape();
    const controller = createSchemaController();
    createFormFromModel<Shape>({
      model,
      schema: shapeSchema(model),
      schemaController: controller,
      behavior: defineFormBehavior<Shape>(({ model }) => {
        applyEach(
          model.$.rows,
          defineFormBehavior<Row>(({ model: row, schema }) => {
            hideWhen(schema.node('details'), () => row.name === '');
          })
        );
      }),
    });

    model.rows.push({ name: '' });
    model.rows.push({ name: 'b' });
    const first = model.rows.at(0);
    const second = model.rows.at(1);
    const conditionsOf = (row: object) => controller.scopeOf(row).__overrideMaps.conditionRegistry;

    expect(conditionsOf(first).get('details')?.()).toBe(true);
    expect(conditionsOf(second).get('details')?.()).toBe(false);

    model.rows.removeAt(0);
    expect(conditionsOf(first).has('details')).toBe(false);
    expect(conditionsOf(second).has('details')).toBe(true);
  });
});

describe('Операторы узлов схемы', () => {
  it('записывают обработчики событий, жизненный цикл и эффекты; `onInit` вызывается сразу', () => {
    const model = createShape();
    const controller = createSchemaController();
    const submit = vi.fn();
    const mounted = vi.fn();
    const unmounted = vi.fn();
    const mountedEffect = vi.fn();
    const init = vi.fn();

    createFormFromModel<Shape>({
      model,
      schemaController: controller,
      behavior: defineFormBehavior<Shape>(({ schema }) => {
        onComponentEvent(schema.node('wizard'), 'onSubmit', submit);
        onMount(schema.node('boundary'), mounted);
        onUnmount(schema.node('boundary'), unmounted);
        renderEffect(schema, mountedEffect);
        onInit(schema.node('wizard'), init);
      }),
    });

    const maps = controller.scopeOf(model).__overrideMaps;
    expect(maps.callbackRegistry.get('wizard')?.get('onSubmit')).toBe(submit);
    expect(maps.lifecycleRegistry.get('boundary')).toEqual({
      onMount: mounted,
      onUnmount: unmounted,
    });
    expect(maps.effectRegistry).toEqual([mountedEffect]);
    expect(init).toHaveBeenCalledTimes(1);
    // Остальное исполняет рендерер — сборка ничего не запускала.
    expect(mounted).not.toHaveBeenCalled();
    expect(mountedEffect).not.toHaveBeenCalled();
  });

  it('снятие поведения убирает его правила', () => {
    const model = createShape();
    const controller = createSchemaController();
    const form = createFormFromModel<Shape>({
      model,
      schemaController: controller,
      behavior: defineFormBehavior<Shape>(({ schema }) => {
        hideWhen(schema.node('block'), () => true);
        onComponentEvent(schema.node('wizard'), 'onSubmit', () => {});
        onMount(schema.node('boundary'), () => {});
        renderEffect(schema, () => {});
      }),
    });

    (form as unknown as { dispose(): void }).dispose();

    const maps = controller.scopeOf(model).__overrideMaps;
    expect(maps.conditionRegistry.size).toBe(0);
    expect(maps.callbackRegistry.get('wizard')?.size).toBe(0);
    expect(maps.lifecycleRegistry.size).toBe(0);
    expect(maps.effectRegistry).toEqual([]);
  });

  it('работают и вне схемы поведения — над отдельной схемой области', () => {
    const scope = createSchemaScope();

    hideWhen(scope.node('block'), () => true);
    onComponentEvent(scope.node('wizard'), 'onSubmit', () => {});

    expect(scope.__overrideMaps.conditionRegistry.has('block')).toBe(true);
    expect(scope.__overrideMaps.callbackRegistry.get('wizard')?.has('onSubmit')).toBe(true);
  });
});

describe('Управление узлом схемы', () => {
  it('setHidden / patchProps уведомляют только подписчиков своего селектора', () => {
    const scope = createSchemaScope();
    const maps = scope.__overrideMaps;
    const target = vi.fn();
    const other = vi.fn();
    maps.versionFor('target').subscribe(target);
    maps.versionFor('other').subscribe(other);
    target.mockClear();
    other.mockClear();

    scope.node('target').setHidden(true).patchProps({ title: 'a' }).patchProps({ hint: 'b' });

    expect(maps.hiddenOverrides.get('target')).toBe(true);
    expect(maps.propsOverrides.get('target')).toEqual({ title: 'a', hint: 'b' });
    expect(target).toHaveBeenCalledTimes(3);
    expect(other).not.toHaveBeenCalled();

    scope.node('target').resetHidden().resetProps();
    expect(maps.hiddenOverrides.has('target')).toBe(false);
    expect(maps.propsOverrides.has('target')).toBe(false);
  });

  it('getRef — обычный объект `{ current: null }`, один на селектор', () => {
    const scope = createSchemaScope();

    const ref = scope.node('wizard').getRef<{ goToStep(step: number): void }>();

    expect(ref).toEqual({ current: null });
    expect(scope.node('wizard').getRef()).toBe(ref);
    expect(scope.node('other').getRef()).not.toBe(ref);
  });
});
