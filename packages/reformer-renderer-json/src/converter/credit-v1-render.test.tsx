/**
 * Разметка документа кредитной заявки прежнего формата (`__fixtures__/credit-application.v1.json`).
 *
 * Формат v1 идёт тем же путём, что и формат 2: конвертер → компилятор схемы ядра → рендерер. Снимок
 * снят до перехода рендерера на скомпилированную схему и закрепляет, что разметка от перехода не
 * изменилась: какие узлы нарисованы, в каком порядке, с какими значениями и строками массивов.
 *
 * Компоненты — заглушки: одна на имя, рисует имя, примитивные пропсы, значение, строки массива и
 * детей. Модель выводится из самого документа: каждый `$model(...)` получает значение, массив —
 * одну строку по своему шаблону.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { createFormFromModel, createModel } from '@reformer/core';
import { FormRenderer, RenderNodeComponent } from '@reformer/renderer-react';
import { collectOperatorNames } from '../collect-operator-names';
import { defineRegistry } from '../registry/component-registry';
import { parseOperator } from '../operators';
import { convertJsonToM1Tree, createRenderSchemaFromJsonM1 } from './json-to-render-schema';
import type { JsonFormSchemaV1 } from '../types/json-schema-v1';

/* eslint-disable @typescript-eslint/no-explicit-any */

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../__fixtures__/credit-application.v1.json', import.meta.url)),
    'utf8'
  )
) as JsonFormSchemaV1;

/** Узел схемы в пропсах компонента: объект с компонентом или привязкой. */
const isNodeLike = (value: unknown): boolean =>
  value !== null &&
  typeof value === 'object' &&
  ('component' in value || 'model' in value || 'children' in value);

/** Заглушка компонента: всё, что важно для разметки, — атрибутами и детьми. */
const stubOf = (name: string) => {
  const Stub = (props: Record<string, any>): ReactNode => {
    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(props)) {
      if (['string', 'number', 'boolean'].includes(typeof value)) {
        attributes[`data-${key.toLowerCase()}`] = String(value);
      }
    }
    const items = Array.isArray(props.items) ? props.items : undefined;
    // Узлы в пропсах (шаги визарда в `steps`) компонент рисует сам — через рендерер.
    const nodeProps = Object.entries(props).flatMap(([key, value]) =>
      Array.isArray(value) && value.every(isNodeLike)
        ? value.map((node, index) => (
            <article key={`${key}-${index}`} data-prop={key}>
              <RenderNodeComponent node={node} />
            </article>
          ))
        : []
    );
    return (
      <div data-c={name} {...attributes}>
        {nodeProps}
        {items?.map((item: { key: string; children: ReactNode }) => (
          <section key={item.key}>{item.children}</section>
        ))}
        {props.children}
      </div>
    );
  };
  Stub.displayName = name;
  return Stub;
};

/** Значение по пути `a.b.c` — с созданием промежуточных групп. */
const setPath = (target: Record<string, any>, path: string, value: unknown): void => {
  const keys = path.split('.');
  let current = target;
  for (const key of keys.slice(0, -1)) current = current[key] ??= {};
  current[keys[keys.length - 1]] ??= value;
};

/** Начальные значения, которых требует документ: лист — строка, массив — одна строка шаблона. */
const initialOf = (node: unknown, target: Record<string, any>): void => {
  if (Array.isArray(node)) {
    for (const child of node) initialOf(child, target);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  const arrayPath = parseOperator(record.array)?.arg;
  const template = (record.item as { $template?: unknown } | undefined)?.$template;
  if (arrayPath && template !== undefined) {
    const row: Record<string, any> = {};
    initialOf(template, row);
    setPath(target, arrayPath, [row]);
  }
  const valuePath = parseOperator(record.value)?.arg;
  if (valuePath) setPath(target, valuePath, `${valuePath}-значение`);
  for (const [key, value] of Object.entries(record)) {
    if (key !== 'item' && typeof value === 'object') initialOf(value, target);
  }
};

const renderFixture = (): string => {
  const initial: Record<string, any> = {};
  initialOf(fixture.root, initial);
  const model = createModel<Record<string, any>>(initial);
  const names = collectOperatorNames(fixture);
  const registry = defineRegistry((reg) => {
    for (const name of names.components) reg.component(name, stubOf(name));
    for (const name of names.dataSources) reg.dataSource(name, []);
    for (const name of names.fns) reg.fn(name, () => '');
  });
  // Форма над моделью: у листьев появляются ноды, без них поле не рисуется.
  createFormFromModel({ model, schema: convertJsonToM1Tree(fixture, registry, model) });
  return renderToStaticMarkup(
    <FormRenderer render={createRenderSchemaFromJsonM1(fixture, registry, model)} />
  );
};

describe('документ прежнего формата: разметка', () => {
  it('совпадает со снимком, снятым до компилятора схемы', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = renderFixture().replace(/></g, '>\n<');

    await expect(html).toMatchFileSnapshot('./__snapshots__/credit-application.v1.html.snap');
    vi.restoreAllMocks();
  });
});

/* eslint-enable @typescript-eslint/no-explicit-any */
