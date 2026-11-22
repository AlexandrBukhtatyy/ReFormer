/**
 * Props обёртки поля до контрола не доходят [ReFormer-66d].
 *
 * Подпись (`label`), описание (`description`) и обязательность (`required`) рисует обёртка поля.
 * Раньше рендерер отдавал их контролу вместе с остальными `componentProps`: на `<input>` появлялись
 * атрибуты `label="Имя"`, а нативный `required` включал проверку браузера, которая блокировала
 * отправку формы раньше её собственной валидации. Исключение — контрол, рисующий подпись рядом
 * с собой (статика `reformerLayout = 'inline-label'`): `label` и `required` нужны ему самому.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { createForm, createModel } from '@reformer/core';
import { msg, type FormLocale } from '@reformer/core/i18n';
import { I18nProvider } from '@reformer/core/react';
import { FormRenderer } from '../src/core/form-renderer';

interface Shape {
  name: string;
  agree: boolean;
}

describe('props обёртки поля в рендерере', () => {
  it('label, description и required контролу не передаются; inline-контрол получает label и required', () => {
    const seen: Record<string, Record<string, unknown>> = {};
    const probe = (key: string) => (props: Record<string, unknown>) => {
      seen[key] = props;
      return null;
    };
    const Inline = Object.assign(probe('agree'), { reformerLayout: 'inline-label' as const });
    const wrapperProps = { label: 'Подпись', description: 'Описание', required: true };

    const bundle = createForm<Shape>({
      model: createModel<Shape>({ name: '', agree: false }),
      schema: (model) => ({
        children: [
          {
            model: model.$.name,
            component: probe('name'),
            componentProps: { ...wrapperProps, placeholder: 'p' },
          },
          { model: model.$.agree, component: Inline, componentProps: wrapperProps },
        ],
      }),
    });

    renderToStaticMarkup(<FormRenderer form={bundle} />);

    expect(seen.name).not.toHaveProperty('label');
    expect(seen.name).not.toHaveProperty('description');
    expect(seen.name).not.toHaveProperty('required');
    expect(seen.name.placeholder).toBe('p');

    expect(seen.agree.label).toBe('Подпись');
    expect(seen.agree.required).toBe(true);
    expect(seen.agree).not.toHaveProperty('description');
  });
});

describe('описатели msg() в пропсах узлов [ReFormer-7ec]', () => {
  it('поле, контейнер и массив получают строки по локали провайдера', () => {
    const seen: Record<string, Record<string, unknown>> = {};
    const probe =
      (key: string) =>
      ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => {
        seen[key] = props;
        return <>{children}</>;
      };
    const locale: FormLocale = {
      code: 'ru',
      messages: { 'f.placeholder': 'Ваше имя', 'f.section': 'Анкета', 'f.add': 'Добавить телефон' },
    };

    const bundle = createForm<Shape & { phones: { number: string }[] }>({
      model: createModel<Shape & { phones: { number: string }[] }>({
        name: '',
        agree: false,
        phones: [],
      }),
      schema: (model) => ({
        component: probe('section'),
        componentProps: { title: msg('f.section') },
        children: [
          {
            model: model.$.name,
            component: probe('name'),
            componentProps: { placeholder: msg('f.placeholder') },
          },
          {
            model: model.$.phones,
            component: probe('phones'),
            componentProps: { addLabel: msg('f.add') },
            item: (row) => ({ children: [{ model: row.$.number, component: probe('number') }] }),
          },
        ],
      }),
    });

    renderToStaticMarkup(
      <I18nProvider locale={locale}>
        <FormRenderer form={bundle} />
      </I18nProvider>
    );

    expect(seen.section.title).toBe('Анкета');
    expect(seen.name.placeholder).toBe('Ваше имя');
    expect(seen.phones.addLabel).toBe('Добавить телефон');
  });
});
