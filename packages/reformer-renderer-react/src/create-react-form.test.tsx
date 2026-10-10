/**
 * Тесты `createReactForm` — сборка формы и рендер-схемы одним вызовом.
 *
 * Ключевое, что здесь закреплено, — инвариант двойной сборки дерева: первый вызов билдера идёт БЕЗ
 * формы (иначе harvest уходит в самоссылки прокси), второй — С формой (иначе визард остаётся без
 * источника значений). Раньше это держалось на комментарии в прикладном коде.
 *
 * Рендер проверяем `renderToString` — jsdom пакету для этого не нужен.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { FC } from 'react';
import { createModel, type FormModel, type FormGroup } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { useFormBundleContext } from '@reformer/core/react';
import { createReactForm } from './create-react-form';
import { FormRenderer } from './core/form-renderer';
import { createRenderSchema } from './core/render-schema-proxy';
import { onInit } from './core/render-behavior';
import type { RenderNode } from './core/types';

interface F {
  email: string;
  agree: boolean;
}

const INITIAL: F = { email: '', agree: false };

const Input: FC<{ value?: unknown }> = () => <i>input</i>;
const Wizard: FC<{ children?: React.ReactNode; form?: unknown }> = ({ form }) => (
  <b>{form ? 'wizard-with-form' : 'wizard-without-form'}</b>
);

/** Билдер того же вида, что в приложениях: узлу визарда нужна форма, полям — сигналы модели. */
const buildSchema = (model: FormModel<F>, form?: FormGroup<F>): RenderNode<F> =>
  ({
    selector: 'wizard',
    component: Wizard,
    componentProps: { form },
    children: [{ model: model.$.email, component: Input }],
  }) as unknown as RenderNode<F>;

describe('createReactForm — сборка', () => {
  it('собирает model, form, render одним вызовом', () => {
    const bundle = createReactForm<F>({ initial: { ...INITIAL }, schema: buildSchema });
    expect(bundle.model.get()).toEqual(INITIAL);
    expect(bundle.form.email.component).toBe(Input);
    expect(typeof bundle.render).toBe('function');
  });

  it('бросает, если не заданы ни initial, ни model', () => {
    expect(() => createReactForm<F>({ schema: buildSchema })).toThrow(/initial|model/i);
  });

  it('билдер вызывается дважды: сперва без формы, затем с ней', () => {
    const calls: Array<FormGroup<F> | undefined> = [];
    const bundle = createReactForm<F>({
      initial: { ...INITIAL },
      schema: (model, form) => {
        calls.push(form);
        return buildSchema(model, form);
      },
    });
    bundle.render(); // второй проход ленивый — материализуем его

    expect(calls).toHaveLength(2);
    expect(calls[0]).toBeUndefined(); // harvest не должен видеть FormGroup
    expect(calls[1]).toBe(bundle.form);
  });

  it('схема, безусловно кладущая форму в componentProps, не роняет сборку', () => {
    const model = createModel<F>({ ...INITIAL });
    // Билдер игнорирует аргумент и всегда подставляет форму «извне» — раньше такой сценарий
    // на втором проходе давал RangeError в harvest.
    let built: FormGroup<F> | undefined;
    const bundle = createReactForm<F>({
      model,
      schema: (m) => buildSchema(m, built),
      setup: (b) => {
        built = b.form;
      },
    });
    expect(bundle.form).toBeTruthy();
  });

  it('renderBehavior получает форму, модель и уровень формы и применяется к схеме', () => {
    const rules = defineValidation<F>(({ model }) => {
      validate(model.$.email, [required()]);
    });
    const seen: unknown[] = [];
    const bundle = createReactForm<F>({
      initial: { ...INITIAL },
      schema: buildSchema,
      validation: rules,
      renderBehavior: (form, model, level) => {
        seen.push(form, model, level);
        return (schema) => {
          onInit(schema.node('wizard'), () => {
            schema.node('wizard').patchProps({ marker: 'applied' });
          });
        };
      },
    });

    expect(seen[0]).toBe(bundle.form);
    expect(seen[1]).toBe(bundle.model);
    // Уровень формы — в бандле: те же правила, отправка и поток.
    expect((seen[2] as typeof bundle).validation).toBe(bundle.validation);
    expect((seen[2] as typeof bundle).submit).toBe(bundle.submit);
    expect(bundle.render.__overrideMaps.propsOverrides.get('wizard')).toMatchObject({
      marker: 'applied',
    });
  });

  it('фазы: seed до сборки формы, setup после появления схемы', () => {
    const order: string[] = [];
    createReactForm<F>({
      initial: { ...INITIAL },
      schema: (model, form) => {
        order.push(form ? 'schema:with-form' : 'schema:no-form');
        return buildSchema(model, form);
      },
      seed: (model) => {
        order.push('seed');
        model.email = 'seeded@x';
      },
      setup: (bundle) => {
        order.push('setup');
        expect(bundle.model.email).toBe('seeded@x');
        expect(typeof bundle.render).toBe('function'); // схема уже есть — можно греть ref'ы
      },
    });
    expect(order).toEqual(['seed', 'schema:no-form', 'setup']);
  });
});

describe('FormRenderer — источник схемы', () => {
  it('берёт схему из бандла form', () => {
    const bundle = createReactForm<F>({ initial: { ...INITIAL }, schema: buildSchema });
    const html = renderToString(<FormRenderer<F> form={bundle} />);
    expect(html).toContain('wizard-with-form'); // рендерится второй проход — с формой
  });

  it('явный проп render важнее бандла', () => {
    const bundle = createReactForm<F>({ initial: { ...INITIAL }, schema: buildSchema });
    const other = createRenderSchema<F>(
      () => ({ component: () => <u>other</u>, children: [] }) as unknown as RenderNode<F>
    );
    const html = renderToString(<FormRenderer<F> render={other} form={bundle} />);
    expect(html).toContain('other');
    expect(html).not.toContain('wizard-with-form');
  });

  it('без обоих источников — внятная ошибка', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderToString(<FormRenderer<F> />)).toThrow(/render.*form|form.*render/i);
    err.mockRestore();
  });
});

describe('FormRenderer — контекст сборки на прежнем пути', () => {
  /** Узел, который читает контекст сборки — как визард в схеме. */
  const ContextProbe: FC = () => {
    const bundle = useFormBundleContext<F>();
    return <s>{bundle && typeof bundle.submit === 'function' ? 'context-level' : 'no-context'}</s>;
  };
  const probeSchema = (): RenderNode<F> =>
    ({ component: ContextProbe, children: [] }) as unknown as RenderNode<F>;

  it('бандл createReactForm пропом form — в контексте сборки', () => {
    const bundle = createReactForm<F>({ initial: { ...INITIAL }, schema: probeSchema });
    expect(renderToString(<FormRenderer<F> form={bundle} />)).toContain('context-level');
  });

  it('функция-схема бандла пропом render — контекст тот же', () => {
    const bundle = createReactForm<F>({ initial: { ...INITIAL }, schema: probeSchema });
    expect(renderToString(<FormRenderer<F> render={bundle.render} />)).toContain('context-level');
  });

  it('голая функция-схема без бандла — контекста нет', () => {
    const render = createRenderSchema<F>(probeSchema);
    expect(renderToString(<FormRenderer<F> render={render} />)).toContain('no-context');
  });
});
