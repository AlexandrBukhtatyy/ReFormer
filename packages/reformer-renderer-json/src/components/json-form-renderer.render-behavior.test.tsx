/**
 * Откуда `JsonFormRenderer` берёт render-behavior: проп → бандл `form`.
 *
 * Через `renderToString`, как и соседний тест про реестр: jsdom пакету не нужен. Источник поведения
 * различаем по видимости узла (`hideWhen`) — это то, что попадает прямо в разметку.
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { FC } from 'react';
import { hideWhen, type RenderBehaviorFn } from '@reformer/renderer-react';
import { JsonFormRenderer } from './json-form-renderer';
import { defineRegistry } from '../registry/component-registry';
import { FIELD_WRAPPER } from '../registry/constants';
import { createJsonForm } from '../create-json-form';
import type { JsonFormSchema } from '../types/json-schema';

interface Model {
  email: string;
}

const Input: FC<{ value?: unknown }> = () => <i>email-field</i>;
const Box: FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;
const Wrapper: FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;

const registry = defineRegistry((reg) => {
  reg.component('Box', Box);
  reg.component('Input', Input);
  reg.component(FIELD_WRAPPER, Wrapper);
});

const schema = {
  root: {
    component: '$component(Box)',
    children: [{ selector: 'email', value: '$model(email)', component: '$component(Input)' }],
  },
} as unknown as JsonFormSchema<Model>;

/** Прячет поле — по его отсутствию в разметке видно, какое поведение доехало до дерева. */
const hideEmail: RenderBehaviorFn<Model> = (proxy) => {
  hideWhen(proxy.node('email'), () => true);
};
/** Ничего не делает — используется как «перекрывающий» проп. */
const noop: RenderBehaviorFn<Model> = () => {};

const build = (renderBehavior?: () => RenderBehaviorFn<Model>) =>
  createJsonForm<Model>({
    schema,
    registry,
    initial: { email: '' },
    ...(renderBehavior ? { renderBehavior } : {}),
  });

describe('JsonFormRenderer — источник renderBehavior', () => {
  it('берёт поведение из бандла, когда пропа нет', () => {
    const jsonForm = build(() => hideEmail);
    const html = renderToString(<JsonFormRenderer<Model> form={jsonForm} />);
    expect(html).not.toContain('email-field'); // поведение из бандла скрыло поле
  });

  it('явный проп перекрывает поведение из бандла', () => {
    const jsonForm = build(() => hideEmail);
    const html = renderToString(<JsonFormRenderer<Model> form={jsonForm} renderBehavior={noop} />);
    expect(html).toContain('email-field'); // сработал проп, а не бандл — поле на месте
  });

  it('без поведения дерево рендерится как есть', () => {
    const html = renderToString(<JsonFormRenderer<Model> form={build()} />);
    expect(html).toContain('email-field');
  });
});
