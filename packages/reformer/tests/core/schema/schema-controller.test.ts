/**
 * Схема-контроллер (`schema-controller`) — хранилища правил узлов по областям.
 *
 * Поведение записывает правила узлов (скрытие, пропсы, ref, обработчики событий, жизненный цикл)
 * в хранилище области, а исполняет их рендерер. Здесь закреплено устройство хранилища: области по
 * под-моделям (`scopeOf`), ключ записи — `selector` узла, он же его `SchemaNodeId` в схеме своей
 * области, счётчики версий (общий и по селектору — `versionFor`), ref на узел (`getRef`) и сверка
 * записанных селекторов со скомпилированной схемой (`unknownSchemaSelectors`).
 */

import { describe, it, expect } from 'vitest';
import { InputStub, SectionStub } from '../../test-utils/stubs';
import {
  createSchemaController,
  createSchemaScope,
  unknownSchemaSelectors,
} from '../../../src/form/schema-controller';
import { compileSchema } from '../../../src/form/schema/compile';
import type {
  CompiledPartNode,
  CompiledSchema,
  SchemaNodeId,
} from '../../../src/form/schema/compiled';
import { createForm } from '../../../src/form/form-bundle';
import { apply, applyEach, defineFormBehavior } from '../../../src/form/behaviors';
import { modelOf } from '../../../src/model/model-value-proxy';
import { arrayOf, createModel, type FormModel } from '../../../src/model/index';
import type { FormSchemaNode } from '../../../src/form/types/schema-node';

interface Address {
  city: string;
}
interface Row {
  name: string;
}
interface Shape {
  email: string;
  home: Address;
  rows: Row[];
}

const createShape = () =>
  createModel<Shape>({
    email: '',
    home: { city: '' },
    rows: arrayOf((): Row => ({ name: '' }), [{ name: 'a' }]),
  });

const addressPart = (model: FormModel<Address>): FormSchemaNode => ({
  selector: 'address',
  children: [{ selector: 'city', model: model.$.city, component: InputStub }],
});

const rowItem = (model: FormModel<Row>): FormSchemaNode => ({
  selector: 'row',
  children: [{ selector: 'name', model: model.$.name, component: InputStub }],
});

const shapeSchema = (model: FormModel<Shape>): FormSchemaNode => ({
  selector: 'root',
  component: SectionStub,
  children: [
    { selector: 'email', model: model.$.email, component: InputStub },
    { model: model.$.email, component: InputStub },
    { selector: 'home', model: model.$.home, part: addressPart },
    { selector: 'rows', model: model.$.rows, item: rowItem },
  ],
});

/** Размеры всех реестров хранилища — для проверки «пусто». */
const sizesOf = (scope: ReturnType<typeof createSchemaScope>) => {
  const maps = scope.__overrideMaps;
  return [
    maps.hiddenOverrides.size,
    maps.propsOverrides.size,
    maps.refRegistry.size,
    maps.conditionRegistry.size,
    maps.callbackRegistry.size,
    maps.lifecycleRegistry.size,
    maps.effectRegistry.length,
  ];
};

describe('schema-controller — области по под-моделям', () => {
  it('область создаётся при первом обращении и дальше та же; у каждой под-модели — своя', () => {
    const model = createShape();
    const controller = createSchemaController();

    const root = controller.scopeOf(model);
    const home = controller.scopeOf(model.home);
    const row = controller.scopeOf(model.rows.at(0)!);

    expect(controller.scopeOf(model)).toBe(root);
    expect(new Set([root, home, row]).size).toBe(3);
    root.node('email').setHidden(true);
    expect(home.__overrideMaps.hiddenOverrides.size).toBe(0);
    expect(row.__overrideMaps.hiddenOverrides.size).toBe(0);
  });

  it('ключ области — идентичность под-модели: группа из ручки и из фасада — одна область', () => {
    const model = createShape();
    const controller = createSchemaController();
    const compiled = compileSchema(shapeSchema(model), model);
    const part = compiled.nodes.get('home' as SchemaNodeId) as CompiledPartNode;
    const rowModel = model.rows.at(0)!;

    // Поведение (`apply`) берёт под-модель по ручке, рендерер — из компиляции: область одна.
    expect(controller.scopeOf(modelOf(model.$.home))).toBe(controller.scopeOf(model.home));
    expect(controller.scopeOf(part.model)).toBe(controller.scopeOf(model.home));
    expect(compiled.arrays.get(model.$.rows)!.row(rowModel).model).toBe(rowModel);
  });

  it('у каждого контроллера свои области на той же модели', () => {
    const model = createShape();

    const first = createSchemaController().scopeOf(model);
    const second = createSchemaController().scopeOf(model);

    expect(first).not.toBe(second);
    expect(first.__overrideMaps).not.toBe(second.__overrideMaps);
  });
});

describe('schema-controller — createSchemaScope', () => {
  it('новая область — пустое хранилище и нулевая версия', () => {
    const scope = createSchemaScope();

    expect(sizesOf(scope)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(scope.__overrideMaps.version.value).toBe(0);
  });

  it('область поверх готового хранилища делит его с владельцем', () => {
    const owner = createSchemaScope();
    const view = createSchemaScope(owner.__overrideMaps);

    view.node('block').setHidden(true);

    expect(view.__overrideMaps).toBe(owner.__overrideMaps);
    expect(owner.__overrideMaps.hiddenOverrides.get('block')).toBe(true);
    expect(owner.__overrideMaps.versionFor('block').value).toBe(1);
  });

  it('node(selector) — новый объект на каждый вызов с селектором и хранилищем; методы цепочкой', () => {
    const scope = createSchemaScope();
    const control = scope.node('block');

    expect(scope.node('block')).not.toBe(control);
    expect(control.__selector).toBe('block');
    expect(control.__overrideMaps).toBe(scope.__overrideMaps);
    expect(control.setHidden(true)).toBe(control);
    expect(control.resetHidden()).toBe(control);
    expect(control.patchProps({ title: 'x' })).toBe(control);
    expect(control.resetProps()).toBe(control);
  });
});

describe('schema-controller — скрытие и пропсы', () => {
  it('setHidden пишет значение (false — явный показ), resetHidden удаляет запись', () => {
    const scope = createSchemaScope();
    const hidden = scope.__overrideMaps.hiddenOverrides;

    scope.node('block').setHidden(false);
    expect([hidden.has('block'), hidden.get('block')]).toEqual([true, false]);

    scope.node('block').setHidden(true);
    expect(hidden.get('block')).toBe(true);

    scope.node('block').resetHidden();
    expect(hidden.has('block')).toBe(false);
    expect(scope.__overrideMaps.propsOverrides.size).toBe(0);
  });

  it('patchProps сливает в новый объект и не держит переданный; resetProps — с чистого листа', () => {
    const scope = createSchemaScope();
    const props = scope.__overrideMaps.propsOverrides;
    const partial = { title: 'Кредит', hint: 'шаг 1' };

    scope.node('step').patchProps(partial);
    partial.title = 'изменено снаружи';
    const first = props.get('step');
    scope.node('step').patchProps({ title: 'Ипотека' });

    expect(first).toEqual({ title: 'Кредит', hint: 'шаг 1' });
    expect(props.get('step')).toEqual({ title: 'Ипотека', hint: 'шаг 1' });
    expect(props.get('step')).not.toBe(first);

    scope.node('step').resetProps();
    expect(props.has('step')).toBe(false);
    scope.node('step').patchProps({ hint: 'заново' });
    expect(props.get('step')).toEqual({ hint: 'заново' });
  });
});

describe('schema-controller — версии', () => {
  it('versionFor — один сигнал на селектор, свой у каждой области; начинается с 0', () => {
    const maps = createSchemaScope().__overrideMaps;

    const block = maps.versionFor('block');

    expect(block.value).toBe(0);
    expect(maps.versionFor('block')).toBe(block);
    expect(maps.versionFor('other')).not.toBe(block);
    expect(createSchemaScope().__overrideMaps.versionFor('block')).not.toBe(block);
  });

  it('каждая правка поднимает общий счётчик и счётчик своего селектора ровно на 1', () => {
    const scope = createSchemaScope();
    const maps = scope.__overrideMaps;
    const node = scope.node('block');
    const edits = [
      () => node.setHidden(true),
      () => node.resetHidden(),
      () => node.patchProps({ title: 'x' }),
      () => node.resetProps(),
    ];

    edits.forEach((edit, index) => {
      edit();
      expect([
        maps.version.value,
        maps.versionFor('block').value,
        maps.versionFor('other').value,
      ]).toEqual([index + 1, index + 1, 0]);
    });
  });

  it('правка без изменения значения тоже поднимает версии', () => {
    // поведение под вопросом [ReFormer-arpz]: повтор того же значения и сброс отсутствующей записи — тоже правка,
    // и рендерер узла перерисуется впустую.
    const scope = createSchemaScope();
    const maps = scope.__overrideMaps;

    scope.node('block').setHidden(true);
    scope.node('block').setHidden(true);
    scope.node('block').resetProps();

    expect(maps.versionFor('block').value).toBe(3);
    expect(maps.propsOverrides.has('block')).toBe(false);
  });

  it('getRef версии не трогает', () => {
    const scope = createSchemaScope();

    scope.node('block').getRef();

    expect(scope.__overrideMaps.version.value).toBe(0);
    expect(scope.__overrideMaps.versionFor('block').value).toBe(0);
  });
});

describe('schema-controller — getRef', () => {
  it('ref регистрируется при первом getRef; дальше — тот же объект с тем же current', () => {
    const scope = createSchemaScope();
    const refs = scope.__overrideMaps.refRegistry;
    expect(refs.has('wizard')).toBe(false);

    const ref = scope.node('wizard').getRef<{ goToStep(step: number): void }>();
    const handle = { goToStep: (_step: number) => undefined };
    ref.current = handle;

    expect(refs.get('wizard')).toBe(ref);
    expect(scope.node('wizard').getRef<typeof handle>().current).toBe(handle);
  });

  it('ref принадлежит области: тот же selector в строке массива — другой ref', () => {
    const model = createShape();
    const controller = createSchemaController();

    const inRoot = controller.scopeOf(model).node('name').getRef();
    const inRow = controller.scopeOf(model.rows.at(0)!).node('name').getRef();

    expect(inRow).not.toBe(inRoot);
  });
});

describe('schema-controller — unknownSchemaSelectors', () => {
  const compiledShape = () => {
    const model = createShape();
    return { model, compiled: compileSchema(shapeSchema(model), model) };
  };

  it('пустое хранилище — пустой список', () => {
    const { compiled } = compiledShape();

    expect(unknownSchemaSelectors(createSchemaScope().__overrideMaps, compiled)).toEqual([]);
  });

  it('сверяются все реестры правил; селекторы, известные схеме, отбрасываются', () => {
    const { compiled } = compiledShape();
    const scope = createSchemaScope();
    const maps = scope.__overrideMaps;

    scope.node('hidden-ghost').setHidden(true);
    scope.node('email').setHidden(true);
    scope.node('props-ghost').patchProps({ title: 'x' });
    maps.conditionRegistry.set('condition-ghost', () => true);
    maps.conditionRegistry.set('home', () => false);
    maps.callbackRegistry.set('callback-ghost', new Map([['onClick', () => undefined]]));
    maps.callbackRegistry.set('root', new Map());
    maps.lifecycleRegistry.set('lifecycle-ghost', { onMount: () => undefined });
    maps.lifecycleRegistry.set('rows', { onUnmount: () => undefined });

    expect(unknownSchemaSelectors(maps, compiled)).toEqual([
      'hidden-ghost',
      'props-ghost',
      'condition-ghost',
      'callback-ghost',
      'lifecycle-ghost',
    ]);
  });

  it('ref и эффекты области в сверку не входят', () => {
    const { compiled } = compiledShape();
    const scope = createSchemaScope();

    scope.node('rows.0.name').getRef();
    scope.__overrideMaps.effectRegistry.push(() => undefined);

    expect(unknownSchemaSelectors(scope.__overrideMaps, compiled)).toEqual([]);
  });

  it('селектор из нескольких реестров назван один раз; сброшенная правка из сверки уходит', () => {
    const { compiled } = compiledShape();
    const scope = createSchemaScope();
    const maps = scope.__overrideMaps;

    scope.node('ghost').setHidden(true).patchProps({ title: 'x' });
    maps.conditionRegistry.set('ghost', () => true);
    scope.node('gone').setHidden(true).resetHidden();

    expect(unknownSchemaSelectors(maps, compiled)).toEqual(['ghost']);
  });

  it('позиционный идентификатор узла без selector селектором не считается', () => {
    const { compiled } = compiledShape();
    const scope = createSchemaScope();
    // `#/1` — поле email без selector: узел есть, но адресовать его правилом нельзя.
    expect(compiled.nodes.get('#/1' as SchemaNodeId)?.kind).toBe('field');

    scope.node('#/1').setHidden(true);

    expect(unknownSchemaSelectors(scope.__overrideMaps, compiled)).toEqual(['#/1']);
  });

  it('узлы подформы и строки известны своей области, а не корню', () => {
    const { model, compiled } = compiledShape();
    const part = compiled.nodes.get('home' as SchemaNodeId) as CompiledPartNode;
    const row = compiled.arrays.get(model.$.rows)!.row(model.rows.at(0)!);
    const rulesOn = (...selectors: string[]) => {
      const scope = createSchemaScope();
      for (const selector of selectors) scope.node(selector).setHidden(true);
      return scope.__overrideMaps;
    };
    const unknownIn = (schema: CompiledSchema) =>
      unknownSchemaSelectors(rulesOn('city', 'name'), schema);

    expect(unknownIn(compiled)).toEqual(['city', 'name']);
    expect(unknownIn(part.content)).toEqual(['name']);
    expect(unknownIn(row)).toEqual(['city']);
  });
});

describe('schema-controller — ключ хранилища и схема области', () => {
  it('поведение корня, подформы и строки пишет в области, которые рендерер найдёт по схеме', () => {
    const bundle = createForm<Shape>({
      model: createShape(),
      schema: shapeSchema,
      behavior: defineFormBehavior<Shape>(({ model, schema }) => {
        schema.node('email').patchProps({ hint: 'корень' });
        apply(
          model.$.home,
          defineFormBehavior<Address>(({ schema: part }) => {
            part.node('city').setHidden(true);
          })
        );
        applyEach(
          model.$.rows,
          defineFormBehavior<Row>(({ schema: row }) => {
            row.node('name').patchProps({ hint: 'строка' });
          })
        );
      }),
    });
    const tree = bundle.render.tree!;
    const part = tree.nodes.get('home' as SchemaNodeId) as CompiledPartNode;
    const row = tree.arrays.get(bundle.model.$.rows)!.row(bundle.model.rows.at(0)!);

    const cases: Array<[CompiledSchema, string]> = [
      [tree, 'email'],
      [part.content, 'city'],
      [row, 'name'],
    ];
    for (const [schema, selector] of cases) {
      const maps = bundle.render.controller.scopeOf(schema.model!).__overrideMaps;
      const keys = [...maps.hiddenOverrides.keys(), ...maps.propsOverrides.keys()];
      // Ключ записи — идентификатор узла в схеме этой области.
      expect(keys).toEqual([selector]);
      expect(schema.nodes.get(selector as SchemaNodeId)?.selector).toBe(selector);
      expect(unknownSchemaSelectors(maps, schema)).toEqual([]);
    }
  });
});
