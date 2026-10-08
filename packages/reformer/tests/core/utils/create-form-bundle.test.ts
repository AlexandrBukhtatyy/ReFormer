/**
 * `createForm` — единая сборка: модель, форма, валидация и дерево для рендера одним вызовом.
 *
 * Проверяет порядок сборки, оба вида схемы (билдер и документ с реестром), область поведения
 * `{ model, form, schema }`, гарды на прежние способы вызова и контекст сборки для React.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createForm } from '../../../src/form/form-bundle';
import { createCoreForm } from '../../../src/form/create-core-form';
import { arrayOf, createModel, type FormModel } from '../../../src/model/index';
import { defineFormBehavior, hideWhen, applyEach } from '../../../src/form/behaviors';
import { defineValidationSchema, validate } from '../../../src/form/validation';
import { required } from '../../../src/form/validators';
import {
  FormBundleContext,
  useFormBundleContext,
} from '../../../src/platforms/react/form-bundle-context';

const InputStub = () => null;
const SectionStub = () => null;

interface Row {
  name: string;
}
interface Shape {
  email: string;
  kind: string;
  rows: Row[];
}

const INITIAL: Shape = { email: '', kind: 'a', rows: [] };

const rowItem = (model: FormModel<Row>) => ({
  selector: 'row',
  component: SectionStub,
  children: [{ model: model.$.name, component: InputStub }],
});

const shapeSchema = (model: FormModel<Shape>) => ({
  selector: 'root',
  component: SectionStub,
  children: [
    { model: model.$.email, component: InputStub },
    {
      selector: 'details',
      component: SectionStub,
      children: [{ model: model.$.kind, component: InputStub }],
    },
    { model: model.$.rows, item: rowItem },
  ],
});

const emailRules = defineValidationSchema<Shape>(({ model }) => {
  validate(model.$.email, [required()]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createForm — сборка', () => {
  it('отдаёт модель, форму, валидацию и дерево для рендера', async () => {
    const bundle = createForm<Shape>({
      initial: { ...INITIAL },
      schema: shapeSchema,
      validation: emailRules,
    });

    expect(bundle.model.get()).toEqual(INITIAL);
    expect(bundle.form.email.component).toBe(InputStub);
    expect(bundle.render.tree).toMatchObject({ selector: 'root' });
    expect(await bundle.validation.validateAll()).toBe(false);
  });

  it('билдер схемы вызывается один раз; дерево в бандле — то же, по которому собрана форма', () => {
    const builder = vi.fn(shapeSchema);

    const bundle = createForm<Shape>({ initial: { ...INITIAL }, schema: builder });

    expect(builder).toHaveBeenCalledTimes(1);
    expect(builder).toHaveBeenCalledWith(bundle.model);
    expect(bundle.render.tree).toBe(builder.mock.results[0].value);
  });

  it('готовая модель приоритетнее `initial`', () => {
    const model = createModel<Shape>({ ...INITIAL, email: 'a@b.c' });

    const bundle = createForm<Shape>({ model, initial: { ...INITIAL } });

    expect(bundle.model).toBe(model);
    expect(bundle.form.email.value.value).toBe('a@b.c');
  });

  it('порядок: seed → дерево → форма → поведение → валидация → setup', () => {
    const order: string[] = [];

    const bundle = createForm<Shape>({
      initial: { ...INITIAL },
      seed: (model) => {
        order.push('seed');
        model.email = 'seeded';
      },
      schema: (model) => {
        order.push(`schema:${model.email}`);
        return shapeSchema(model);
      },
      behavior: defineFormBehavior<Shape>(({ form }) => {
        order.push(`behavior:${typeof form.email.setValue}`);
      }),
      validation: emailRules,
      setup: (bundle) => {
        order.push(`setup:${bundle.validation !== undefined}`);
      },
    });

    expect(order).toEqual(['seed', 'schema:seeded', 'behavior:function', 'setup:true']);
    expect(bundle.model.email).toBe('seeded');
  });

  it('без схемы форма строится по модели, дерева нет', () => {
    const bundle = createForm<Shape>({ initial: { ...INITIAL } });

    expect(bundle.render.tree).toBeUndefined();
    bundle.form.email.setValue('x');
    expect(bundle.model.email).toBe('x');
    expect(bundle.validation).toBeUndefined();
  });

  it('`createCoreForm` — та же сборка под прежним именем', () => {
    const bundle = createCoreForm<Shape>({ initial: { ...INITIAL }, schema: shapeSchema });

    expect(bundle.form.email.component).toBe(InputStub);
    expect((bundle as { render?: unknown }).render).toBeDefined();
  });
});

describe('createForm — схема в поведении', () => {
  it('`schema` поведения — корневая область; `render.node` управляет ею же', () => {
    const bundle = createForm<Shape>({
      initial: { ...INITIAL },
      schema: shapeSchema,
      behavior: defineFormBehavior<Shape>(({ model, schema }) => {
        hideWhen(schema.node('details'), () => model.kind === 'a');
      }),
    });

    const root = bundle.render.controller.scopeOf(bundle.model).__overrideMaps;
    expect(root.conditionRegistry.get('details')?.()).toBe(true);

    bundle.render.node('details').setHidden(false);
    expect(root.hiddenOverrides.get('details')).toBe(false);
  });

  it('правило на узел, которого нет в корневом дереве, — предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createForm<Shape>({
      initial: { ...INITIAL },
      schema: shapeSchema,
      behavior: defineFormBehavior<Shape>(({ schema }) => {
        hideWhen(schema.node('row'), () => true); // узел строки: корню он не виден
        hideWhen(schema.node('details'), () => true);
      }),
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"row"'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('"details"'));
  });

  it('узел строки адресуется из поведения строки — без предупреждений', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = createForm<Shape>({
      model: createModel<Shape>({ ...INITIAL, rows: arrayOf(() => ({ name: '' })) }),
      schema: shapeSchema,
      behavior: defineFormBehavior<Shape>(({ model }) => {
        applyEach(
          model.$.rows,
          defineFormBehavior<Row>(({ model: row, schema }) => {
            hideWhen(schema.node('row'), () => row.name === 'hidden');
          })
        );
      }),
    });

    bundle.model.rows.push();
    const row = bundle.model.rows.at(0);

    expect(warn).not.toHaveBeenCalled();
    expect(bundle.render.controller.scopeOf(row).__overrideMaps.conditionRegistry.has('row')).toBe(
      true
    );
  });

  it('ref разрешено брать по пути модели — без предупреждения', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createForm<Shape>({
      initial: { ...INITIAL },
      schema: shapeSchema,
      behavior: defineFormBehavior<Shape>(({ schema }) => {
        schema.node('rows.0.name').getRef();
      }),
    });

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('createForm — проверки селекторов при сборке', () => {
  const stepsSchema = (model: FormModel<Shape>) => ({
    selector: 'wizard',
    component: SectionStub,
    children: [
      {
        selector: 'contacts',
        component: SectionStub,
        children: [{ model: model.$.email, component: InputStub }],
      },
      {
        selector: 'details',
        component: SectionStub,
        children: [{ model: model.$.kind, component: InputStub }],
      },
    ],
  });
  const kindRules = defineValidationSchema<Shape>(({ model }) => {
    validate(model.$.kind, [required()]);
  });

  it('повтор `selector` в корневом дереве — предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createForm<Shape>({
      initial: { ...INITIAL },
      schema: (model) => ({
        children: [
          { selector: 'section', component: SectionStub },
          { selector: 'section', component: SectionStub },
          { selector: 'other', component: SectionStub, children: [{ selector: 'other' }] },
          { model: model.$.email, component: InputStub },
        ],
      }),
    });

    const [message] =
      warn.mock.calls.find(([text]) => String(text).includes('повторяются селекторы')) ?? [];
    expect(message).toContain('"section", "other"');
  });

  it('селектор строки массива корневому дереву не принадлежит — повтором не считается', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createForm<Shape>({
      initial: { ...INITIAL, rows: [{ name: 'a' }, { name: 'b' }] },
      schema: (model) => ({
        children: [
          { selector: 'row', component: SectionStub },
          { model: model.$.rows, item: rowItem },
        ],
      }),
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it('ключ `validation.steps` без шага в дереве — предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createForm<Shape>({
      initial: { ...INITIAL },
      schema: stepsSchema,
      validation: { steps: { contacts: emailRules, detials: kindRules } },
    });

    const [message] = warn.mock.calls.find(([text]) => String(text).includes('нет шага')) ?? [];
    expect(message).toContain('"detials"');
    expect(message).not.toContain('"contacts"');
  });

  it('все ключи `validation.steps` совпали с шагами — предупреждений нет', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createForm<Shape>({
      initial: { ...INITIAL },
      schema: stepsSchema,
      validation: { steps: { contacts: emailRules, details: null } },
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it('дерево шагов не описывает (визард собран в JSX) — ключи шагов не сверяются', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createForm<Shape>({
      initial: { ...INITIAL },
      schema: (model) => ({ children: [{ model: model.$.email, component: InputStub }] }),
      validation: { steps: { contacts: emailRules, details: kindRules } },
    });
    createForm<Shape>({
      initial: { ...INITIAL },
      validation: { steps: { contacts: emailRules } },
    });

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('createForm — документ схемы и реестр', () => {
  const document = { format: 2, root: { component: '$component(Section)' } };

  it('дерево собирает `registry.resolveSchema`; обёртка поля и граница ошибок едут в бандле', () => {
    const FieldWrapper = () => null;
    const ErrorBoundary = () => null;
    const resolveSchema = vi.fn((_document: unknown, model: FormModel<never>) => ({
      tree: shapeSchema(model as unknown as FormModel<Shape>),
      fieldWrapper: FieldWrapper,
      errorBoundary: ErrorBoundary,
    }));

    const bundle = createForm<Shape>({
      initial: { ...INITIAL },
      schema: document,
      registry: { resolveSchema },
    });

    expect(resolveSchema).toHaveBeenCalledTimes(1);
    expect(resolveSchema).toHaveBeenCalledWith(document, bundle.model);
    expect(bundle.form.email.component).toBe(InputStub);
    expect(bundle.render.fieldWrapper).toBe(FieldWrapper);
    expect(bundle.render.errorBoundary).toBe(ErrorBoundary);
  });

  it('реестр без `resolveSchema` — понятная ошибка', () => {
    expect(() =>
      createForm<Shape>({ initial: { ...INITIAL }, schema: document, registry: {} })
    ).toThrow(/registry.*resolveSchema/s);
  });
});

describe('createForm — гарды на прежние способы вызова', () => {
  it('готовое дерево без реестра — отсылка к createFormFromModel', () => {
    const model = createModel<Shape>({ ...INITIAL });

    expect(() => createForm<Shape>({ model, schema: shapeSchema(model) })).toThrow(
      /готовое дерево.*createFormFromModel/s
    );
  });

  it('конфиг без модели — требование модели', () => {
    const fieldsWithoutModel = { email: { value: '', component: InputStub } };

    expect(() => createForm<Shape>(fieldsWithoutModel as never)).toThrow(/нужна модель.*initial/s);
    expect(() => createForm<Shape>({})).toThrow(/initial|model/i);
  });
});

describe('Контекст сборки для React', () => {
  const Probe = () => {
    const bundle = useFormBundleContext<Shape>();
    return createElement('span', null, bundle ? `kind=${bundle.model.kind}` : 'нет сборки');
  };

  it('компонент внутри провайдера получает бандл', () => {
    const bundle = createForm<Shape>({ initial: { ...INITIAL, kind: 'mortgage' } });

    const html = renderToStaticMarkup(
      createElement(FormBundleContext.Provider, { value: bundle }, createElement(Probe))
    );

    expect(html).toBe('<span>kind=mortgage</span>');
  });

  it('вне провайдера — null', () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<span>нет сборки</span>');
  });
});
