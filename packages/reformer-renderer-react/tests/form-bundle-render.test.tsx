/**
 * Рендер бандла `createForm`: узлы `model` / `item` / `part`, области схемы и правила узлов из
 * поведения формы.
 *
 * Рендер — через `renderToStaticMarkup` (DOM-окружения в пакете нет), поэтому проверяется то, что
 * видно в первой отрисовке: дерево, видимость, пропсы, обёртка поля, контекст сборки.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import {
  arrayOf,
  createForm,
  createModel,
  useFormBundleContext,
  type FormModel,
} from '@reformer/core';
import {
  apply,
  applyEach,
  defineFormBehavior,
  hideWhen,
  onComponentEvent,
} from '@reformer/core/behaviors';
import { FormRenderer } from '../src/core/form-renderer';
import type { ArrayComponentProps, FieldWrapperProps, RenderNode } from '../src/core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Address {
  city: string;
  street: string;
}
interface Row {
  name: string;
  note: string;
}
interface Shape {
  kind: string;
  registration: Address;
  residence: Address;
  rows: Row[];
}

const blankRow = (): Row => ({ name: '', note: '' });
const createShape = (over: Partial<Shape> = {}) =>
  createModel<Shape>({
    kind: 'a',
    registration: { city: 'Казань', street: '' },
    residence: { city: 'Москва', street: '' },
    rows: arrayOf(blankRow, [
      { name: 'первый', note: '' },
      { name: 'второй', note: '' },
    ]),
    ...over,
  });

const Input = ({ value, label }: any) => (
  <input data-label={label} defaultValue={String(value ?? '')} />
);
const Section = ({ title, children }: { title?: string; children?: ReactNode }) => (
  <section data-title={title}>{children}</section>
);
const List = ({ items }: ArrayComponentProps) => (
  <ul>
    {items.map((item) => (
      <li key={item.key}>{item.children}</li>
    ))}
  </ul>
);

const address = (model: FormModel<Address>): RenderNode<Shape> => ({
  component: Section,
  children: [
    { model: model.$.city, component: Input, componentProps: { label: 'Город' } },
    {
      selector: 'street',
      component: Section,
      componentProps: { title: 'улица' },
      children: [{ model: model.$.street, component: Input, componentProps: { label: 'Улица' } }],
    },
  ],
});

const row = (model: FormModel<Row>): RenderNode<Shape> => ({
  component: Section,
  children: [
    { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
    {
      selector: 'note',
      component: Section,
      componentProps: { title: 'заметка' },
      children: [{ model: model.$.note, component: Input, componentProps: { label: 'Заметка' } }],
    },
  ],
});

const shapeSchema = (model: FormModel<Shape>): RenderNode<Shape> => ({
  selector: 'root',
  component: Section,
  children: [
    { model: model.$.kind, component: Input, componentProps: { label: 'Вид' } },
    {
      selector: 'registration',
      component: Section,
      componentProps: { title: 'регистрация' },
      children: [{ model: model.$.registration, part: address }],
    },
    {
      selector: 'residence',
      component: Section,
      componentProps: { title: 'проживание' },
      children: [{ model: model.$.residence, part: address }],
    },
    { model: model.$.rows, component: List, item: row },
  ],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FormRenderer — бандл createForm', () => {
  it('рисует поле, подформу (дважды) и строки массива', () => {
    const bundle = createForm<Shape>({ model: createShape(), schema: shapeSchema });

    const html = renderToStaticMarkup(<FormRenderer form={bundle} />);

    expect(html).toContain('data-label="Вид"');
    expect(html.match(/data-label="Город"/g)).toHaveLength(2);
    expect(html).toContain('value="Казань"');
    expect(html).toContain('value="Москва"');
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html).toContain('value="первый"');
  });

  it('билдеры `item` и `part` вызываются по разу на под-модель — сборкой, не рендером', () => {
    const itemBuilder = vi.fn(row);
    const partBuilder = vi.fn(address);
    const bundle = createForm<Shape>({
      model: createShape(),
      schema: (model) => ({
        component: Section,
        children: [
          { model: model.$.registration, part: partBuilder },
          { model: model.$.rows, component: List, item: itemBuilder },
        ],
      }),
    });

    renderToStaticMarkup(<FormRenderer form={bundle} />);
    renderToStaticMarkup(<FormRenderer form={bundle} />);

    expect(partBuilder).toHaveBeenCalledTimes(1);
    expect(itemBuilder).toHaveBeenCalledTimes(2); // две строки
  });

  it('`hideWhen` из корневого поведения скрывает узел корневого дерева', () => {
    const model = createShape();
    const bundle = createForm<Shape>({
      model,
      schema: shapeSchema,
      behavior: defineFormBehavior<Shape>(({ model, schema }) => {
        hideWhen(schema.node('residence'), () => model.kind === 'a');
      }),
    });

    expect(renderToStaticMarkup(<FormRenderer form={bundle} />)).not.toContain('проживание');

    model.kind = 'b';
    expect(renderToStaticMarkup(<FormRenderer form={bundle} />)).toContain('проживание');
  });

  it('области изолированы: правило подформы действует только в своей группе', () => {
    const addressBehavior = defineFormBehavior<Address>(({ model, schema }) => {
      hideWhen(schema.node('street'), () => model.city === 'Москва');
    });
    const bundle = createForm<Shape>({
      model: createShape(),
      schema: shapeSchema,
      behavior: defineFormBehavior<Shape>(({ model }) => {
        apply([model.$.registration, model.$.residence], addressBehavior);
      }),
    });

    const html = renderToStaticMarkup(<FormRenderer form={bundle} />);

    // Улица скрыта у адреса проживания (Москва) и видна у адреса регистрации (Казань).
    expect(html.match(/data-title="улица"/g)).toHaveLength(1);
    expect(html.match(/data-label="Город"/g)).toHaveLength(2);
  });

  it('правило строки массива действует в своей строке', () => {
    const bundle = createForm<Shape>({
      model: createShape(),
      schema: shapeSchema,
      behavior: defineFormBehavior<Shape>(({ model }) => {
        applyEach(
          model.$.rows,
          defineFormBehavior<Row>(({ model: rowModel, schema }) => {
            hideWhen(schema.node('note'), () => rowModel.name === 'первый');
          })
        );
      }),
    });

    const html = renderToStaticMarkup(<FormRenderer form={bundle} />);

    expect(html.match(/data-title="заметка"/g)).toHaveLength(1);
  });

  it('`patchProps` и обработчик события доходят до компонента узла', () => {
    const submit = vi.fn();
    const seen: Array<Record<string, unknown>> = [];
    const Probe = (props: Record<string, unknown>) => {
      seen.push(props);
      return null;
    };
    const bundle = createForm<Shape>({
      model: createShape(),
      schema: () => ({
        selector: 'probe',
        component: Probe,
        componentProps: { title: 'исходный' },
      }),
      behavior: defineFormBehavior<Shape>(({ schema }) => {
        schema.node('probe').patchProps({ title: 'новый' });
        onComponentEvent(schema.node('probe'), 'onSubmit', submit);
      }),
    });

    renderToStaticMarkup(<FormRenderer form={bundle} />);

    expect(seen[0].title).toBe('новый');
    expect(seen[0].onSubmit).toBe(submit);
  });

  it('обёртка поля: настройка рендерера главнее той, что в бандле', () => {
    const BundleWrapper = ({ children }: FieldWrapperProps) => (
      <div data-wrap="bundle">{children}</div>
    );
    const SettingsWrapper = ({ children }: FieldWrapperProps) => (
      <div data-wrap="settings">{children}</div>
    );
    const model = createShape();
    const bundle = createForm<Shape>({
      model,
      schema: { format: 2 },
      registry: {
        resolveSchema: () => ({
          tree: { model: model.$.kind, component: Input },
          fieldWrapper: BundleWrapper,
        }),
      },
    });

    expect(renderToStaticMarkup(<FormRenderer form={bundle} />)).toContain('data-wrap="bundle"');
    expect(
      renderToStaticMarkup(
        <FormRenderer form={bundle} settings={{ fieldWrapper: SettingsWrapper }} />
      )
    ).toContain('data-wrap="settings"');
  });

  it('граница ошибок из бандла оборачивает дерево', () => {
    const Boundary = ({ children }: { children: ReactNode }) => (
      <div data-boundary="yes">{children}</div>
    );
    const model = createShape();
    const bundle = createForm<Shape>({
      model,
      schema: { format: 2 },
      registry: {
        resolveSchema: () => ({
          tree: { model: model.$.kind, component: Input },
          errorBoundary: Boundary,
        }),
      },
    });

    expect(renderToStaticMarkup(<FormRenderer form={bundle} />)).toMatch(
      /^<div data-boundary="yes">.*<input/
    );
  });

  it('компонент узла получает бандл из контекста сборки', () => {
    const WizardProbe = () => {
      const bundle = useFormBundleContext<Shape>();
      return <b>{bundle ? `форма:${bundle.form.kind.value.value}` : 'нет сборки'}</b>;
    };
    const bundle = createForm<Shape>({
      model: createShape(),
      schema: () => ({ component: WizardProbe }),
    });

    expect(renderToStaticMarkup(<FormRenderer form={bundle} />)).toBe('<b>форма:a</b>');
  });

  it('компонент с `__selfManagedChildren` получает узлы и `renderNode`', () => {
    const Steps = ({ children, renderNode }: any) => (
      <ol>
        {(children as RenderNode<Shape>[]).map((child, index) => (
          <li key={index} data-step={(child as { selector?: string }).selector}>
            {renderNode(child)}
          </li>
        ))}
      </ol>
    );
    Steps.__selfManagedChildren = true;
    const bundle = createForm<Shape>({
      model: createShape(),
      schema: (model) => ({
        component: Steps,
        children: [
          {
            selector: 'first',
            component: Section,
            children: [{ model: model.$.kind, component: Input, componentProps: { label: 'Вид' } }],
          },
          { selector: 'second', component: Section, componentProps: { title: 'пусто' } },
        ],
      }),
    });

    const html = renderToStaticMarkup(<FormRenderer form={bundle} />);

    expect(html).toContain('data-step="first"');
    expect(html).toContain('data-label="Вид"');
    expect(html).toContain('data-step="second"');
  });

  it('бандл без схемы — понятная ошибка', () => {
    const bundle = createForm<Shape>({ model: createShape() });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderToStaticMarkup(<FormRenderer form={bundle} />)).toThrow(/нет дерева/);
  });
});

describe('Кнопка «Добавить» секции массива', () => {
  const captureList = (captured: ArrayComponentProps[]) => (props: ArrayComponentProps) => {
    captured.push(props);
    return null;
  };

  it('берёт шаблон модели (`arrayOf`)', () => {
    const captured: ArrayComponentProps[] = [];
    const model = createShape();
    const bundle = createForm<Shape>({
      model,
      schema: (model) => ({ model: model.$.rows, component: captureList(captured), item: row }),
    });

    renderToStaticMarkup(<FormRenderer form={bundle} />);
    captured[0].onAdd();

    expect(model.get().rows).toHaveLength(3);
    expect(model.get().rows[2]).toEqual({ name: '', note: '' });
  });

  it('`initialValue` узла — запасной шаблон для модели без `arrayOf`', () => {
    const captured: ArrayComponentProps[] = [];
    const model = createShape({ rows: [] });
    const bundle = createForm<Shape>({
      model,
      schema: (model) => ({
        model: model.$.rows,
        component: captureList(captured),
        item: row,
        initialValue: { name: 'из схемы', note: '' },
      }),
    });

    renderToStaticMarkup(<FormRenderer form={bundle} />);
    captured[0].onAdd();

    expect(model.get().rows).toEqual([{ name: 'из схемы', note: '' }]);
  });
});
