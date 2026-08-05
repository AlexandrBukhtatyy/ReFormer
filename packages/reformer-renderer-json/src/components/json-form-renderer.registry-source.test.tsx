/**
 * Откуда `JsonFormRenderer` берёт реестр: проп → бандл `form` → контекст.
 *
 * Почему через `renderToString`, а не testing-library: пакету не нужен jsdom ради этих проверок —
 * рендер в строку выполняется в node и полностью покрывает интересующее поведение (упало/не упало,
 * какой компонент отрисовался).
 *
 * Ключевой сценарий — микрофронты: провайдер хоста и рендерер ремоута живут в разных бандлах,
 * React-контекст границу не пересекает. До появления пропа обойти это было нечем.
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { FC } from 'react';
import { JsonFormRenderer } from './json-form-renderer';
import { JsonRendererProvider } from '../context/json-renderer-context';
import { defineRegistry } from '../registry/component-registry';
import { FIELD_WRAPPER } from '../registry/constants';
import { createJsonForm } from '../create-json-form';
import type { JsonFormSchema } from '../types/json-schema';

interface Model {
  email: string;
}

const FromProp: FC<{ value?: unknown }> = () => <i>from-prop</i>;
const FromContext: FC<{ value?: unknown }> = () => <i>from-context</i>;
const Wrapper: FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;
/** Обёртка поля с меткой — чтобы отличить «обёртка применена» от «поле отрисовалось голым». */
const MarkedWrapper: FC<{ children?: React.ReactNode }> = ({ children }) => (
  <u data-wrapped="yes">{children}</u>
);

const schema: JsonFormSchema<Model> = {
  root: {
    component: '$component(Box)',
    children: [{ value: '$model(email)', component: '$component(Input)' }],
  },
} as unknown as JsonFormSchema<Model>;

const makeRegistry = (Input: FC<{ value?: unknown }>) =>
  defineRegistry((r) => {
    r.component('Box', Wrapper as FC);
    r.component('Input', Input);
    r.component(FIELD_WRAPPER, Wrapper as FC);
  });

describe('JsonFormRenderer — источник реестра', () => {
  it('работает БЕЗ провайдера, когда реестр передан пропом', () => {
    const registry = makeRegistry(FromProp);
    const form = createJsonForm<Model>({ schema, registry, initial: { email: '' } });

    // Намеренно без <JsonRendererProvider>: до пропа `registry` это падало —
    // в DEV из-за guard'а в useJsonRendererSettings, в prod молча ломалось в конвертере.
    const html = renderToString(<JsonFormRenderer<Model> form={form} registry={registry} />);
    expect(html).toContain('from-prop');
  });

  it('берёт реестр из бандла `form`, когда пропа нет и провайдера нет', () => {
    const registry = makeRegistry(FromProp);
    const form = createJsonForm<Model>({ schema, registry, initial: { email: '' } });

    const html = renderToString(<JsonFormRenderer<Model> form={form} />);
    expect(html).toContain('from-prop');
  });

  it('проп перекрывает контекст', () => {
    const ctxRegistry = makeRegistry(FromContext);
    const propRegistry = makeRegistry(FromProp);
    const form = createJsonForm<Model>({ schema, registry: propRegistry, initial: { email: '' } });

    const html = renderToString(
      <JsonRendererProvider settings={{ registry: ctxRegistry }}>
        <JsonFormRenderer<Model> form={form} registry={propRegistry} />
      </JsonRendererProvider>
    );
    expect(html).toContain('from-prop');
    expect(html).not.toContain('from-context');
  });

  it('без пропа и без бандла реестр берётся из контекста', () => {
    const ctxRegistry = makeRegistry(FromContext);
    const model = createJsonForm<Model>({
      schema,
      registry: ctxRegistry,
      initial: { email: '' },
    }).model;

    const html = renderToString(
      <JsonRendererProvider settings={{ registry: ctxRegistry }}>
        <JsonFormRenderer<Model> schema={schema} model={model} />
      </JsonRendererProvider>
    );
    expect(html).toContain('from-context');
  });

  it('обёртка полей берётся из реестра, пришедшего пропом (регрессия: терялась)', () => {
    // `$fieldWrapper` — не обычный компонент: его достаёт из реестра ПРОВАЙДЕР и кладёт в
    // settings.fieldWrapper контекста. Реестр, пришедший пропом, провайдера не проходит,
    // поэтому обёртка молча пропадала: поля рендерились голыми, без label/error.
    // Симптом в витрине — `<input label="Фамилия">` вместо размеченного поля.
    const registry = defineRegistry((r) => {
      r.component('Box', Wrapper as FC);
      r.component('Input', FromProp);
      r.component(FIELD_WRAPPER, MarkedWrapper as FC);
    });
    const form = createJsonForm<Model>({ schema, registry, initial: { email: '' } });

    const html = renderToString(<JsonFormRenderer<Model> form={form} registry={registry} />);
    expect(html).toContain('data-wrapped="yes"');
  });

  it('обёртка следует за реестром: проп перекрывает обёртку контекста', () => {
    const ctxRegistry = defineRegistry((r) => {
      r.component('Box', Wrapper as FC);
      r.component('Input', FromContext);
      r.component(FIELD_WRAPPER, Wrapper as FC); // без метки
    });
    const propRegistry = defineRegistry((r) => {
      r.component('Box', Wrapper as FC);
      r.component('Input', FromProp);
      r.component(FIELD_WRAPPER, MarkedWrapper as FC); // с меткой
    });
    const form = createJsonForm<Model>({ schema, registry: propRegistry, initial: { email: '' } });

    const html = renderToString(
      <JsonRendererProvider settings={{ registry: ctxRegistry }}>
        <JsonFormRenderer<Model> form={form} registry={propRegistry} />
      </JsonRendererProvider>
    );
    expect(html).toContain('data-wrapped="yes"');
  });

  it('без единого источника реестра — внятная ошибка, а не падение в конвертере', () => {
    const model = createJsonForm<Model>({
      schema,
      registry: makeRegistry(FromProp),
      initial: { email: '' },
    }).model;

    expect(() => renderToString(<JsonFormRenderer<Model> schema={schema} model={model} />)).toThrow(
      /settings\.registry is required|No registry found/
    );
  });
});
