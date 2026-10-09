/**
 * Прежние имена переименованных компонентов (`FormArray` → `FieldArray`,
 * `FormArraySection` → `FieldArraySection`): реестр разрешает их в записи под новым именем,
 * проверка схемы считает известными, документ со старым именем рендерится как с новым.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { arrayOf, createForm, createModel } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import { composeRegistries, defineRegistry } from './component-registry';
import { renamedComponentOf, warnRenamedComponent } from './renamed-components';
import { getComponentNames } from '../schema';
import { validateFormSchema } from '../validate';
import { collectOperatorNames } from '../collect-operator-names';
import type { JsonFormSchema } from '../types/json-schema';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Предупреждение помнит уже названные имена на уровне модуля, поэтому в тестах реестра оно
// подменено шпионом; настоящее проверяется отдельно, на свежей копии модуля.
vi.mock('./renamed-components', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./renamed-components')>()),
  warnRenamedComponent: vi.fn(),
}));

const FieldArray = ({ items }: any) => (
  <ul>
    {items.map((item: any) => (
      <li key={item.key}>{item.children}</li>
    ))}
  </ul>
);
const FieldArraySection = ({ children }: { children?: ReactNode }) => <section>{children}</section>;
const Input = ({ value }: any) => <input defaultValue={String(value ?? '')} />;
const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

const createRegistry = () =>
  defineRegistry((reg) => {
    reg.component('FieldArray', FieldArray);
    reg.component('FieldArraySection', FieldArraySection);
    reg.component('Input', Input);
    reg.component('Box', Box);
  });

afterEach(() => {
  vi.mocked(warnRenamedComponent).mockClear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('реестр: прежнее имя переименованного компонента', () => {
  it('`renamedComponentOf` знает оба прежних имени и только их', () => {
    expect(renamedComponentOf('FormArray')).toBe('FieldArray');
    expect(renamedComponentOf('FormArraySection')).toBe('FieldArraySection');
    expect(renamedComponentOf('FieldArray')).toBeUndefined();
    expect(renamedComponentOf('Input')).toBeUndefined();
    // Имя из прототипа объекта переименованием не считается.
    expect(renamedComponentOf('constructor')).toBeUndefined();
  });

  it('`get` и `has` разрешают прежнее имя в запись под новым', () => {
    const registry = createRegistry();

    expect(registry.get('FormArray')?.component).toBe(FieldArray);
    expect(registry.get('FormArraySection')?.component).toBe(FieldArraySection);
    expect(registry.has('FormArray')).toBe(true);
    expect(registry.has('FormArraySection')).toBe(true);
  });

  it('`get` сообщает о прежнем имени, `has` — нет', () => {
    const registry = createRegistry();

    registry.has('FormArray');
    expect(warnRenamedComponent).not.toHaveBeenCalled();

    registry.get('FormArray');
    expect(warnRenamedComponent).toHaveBeenCalledWith('FormArray', 'FieldArray');
  });

  it('прежних имён нет в `names()`: в перечни и подсказки они не попадают', () => {
    const registry = createRegistry();

    expect(registry.names()).not.toContain('FormArray');
    expect(getComponentNames(registry)).toEqual([
      'FieldArray',
      'FieldArraySection',
      'Input',
      'Box',
    ]);
  });

  it('запись, зарегистрированная под прежним именем, важнее псевдонима', () => {
    const Own = (): null => null;
    const registry = composeRegistries(
      createRegistry(),
      defineRegistry((reg) => reg.component('FormArray', Own))
    );

    expect(registry.get('FormArray')?.component).toBe(Own);
    expect(warnRenamedComponent).not.toHaveBeenCalled();
  });

  it('псевдоним работает сквозь цепочку реестров', () => {
    const registry = composeRegistries(
      createRegistry(),
      defineRegistry((reg) => reg.component('Extra', Box))
    );

    expect(registry.get('FormArray')?.component).toBe(FieldArray);
    expect(registry.has('FormArray')).toBe(true);
  });

  it('без записи под новым именем прежнее имя неизвестно', () => {
    const registry = defineRegistry((reg) => reg.component('Input', Input));

    expect(registry.get('FormArray')).toBeUndefined();
    expect(registry.has('FormArray')).toBe(false);
  });

  it('псевдоним указывает только на компонент: источник данных с новым именем не подходит', () => {
    const registry = defineRegistry((reg) => reg.dataSource('FieldArray', [1, 2, 3]));

    expect(registry.get('FormArray')).toBeUndefined();
    expect(registry.has('FormArray')).toBe(false);
    expect(registry.getDataSource('FormArray')).toBeUndefined();
  });
});

describe('предупреждение о прежнем имени', () => {
  /** Свежая копия модуля: память об уже названных именах у неё пустая. */
  const loadActual = async () => {
    vi.resetModules();
    return vi.importActual<typeof import('./renamed-components')>('./renamed-components');
  };

  it('одно на имя', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const actual = await loadActual();

    actual.warnRenamedComponent('FormArray', 'FieldArray');
    actual.warnRenamedComponent('FormArray', 'FieldArray');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('"FormArray" переименован в "FieldArray"');

    actual.warnRenamedComponent('FormArraySection', 'FieldArraySection');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('в production молчит', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const actual = await loadActual();

    actual.warnRenamedComponent('FormArray', 'FieldArray');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('проверка схемы: документ с прежним именем компонента', () => {
  const documentWith = (arrayComponent: string): JsonFormSchema => ({
    format: 2,
    root: {
      component: '$component(Box)',
      children: [
        {
          model: '$model(phones)',
          component: `$component(${arrayComponent})`,
          componentProps: { addLabel: 'Добавить' },
          item: { $template: { model: '$model(number)', component: '$component(Input)' } },
        },
      ],
    },
  });

  it('проходит по реестру, где запись лежит под новым именем', () => {
    const registry = createRegistry();

    expect(validateFormSchema(documentWith('FormArray'), { registry }).errors).toEqual([]);
    expect(validateFormSchema(documentWith('FieldArray'), { registry }).errors).toEqual([]);
  });

  it('проходит по явному списку имён', () => {
    const result = validateFormSchema(documentWith('FormArray'), {
      componentNames: ['Box', 'Input', 'FieldArray'],
    });

    expect(result.errors).toEqual([]);
  });

  it('без нового имени в списке прежнее имя — неизвестный компонент', () => {
    const result = validateFormSchema(documentWith('FormArray'), {
      componentNames: ['Box', 'Input'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toMatch(/unknown component "FormArray"/);
  });

  it('пропсы под прежним именем проверяются по схеме нынешнего компонента', () => {
    const propSchemas = {
      FieldArray: {
        type: 'object' as const,
        properties: { addLabel: { type: 'string' as const } },
        additionalProperties: false,
      },
    };
    const broken = documentWith('FormArray');
    (broken.root as any).children[0].componentProps = { addLabel: 5 };

    expect(validateFormSchema(documentWith('FormArray'), { propSchemas }).errors).toEqual([]);
    expect(validateFormSchema(broken, { propSchemas }).errors.join('\n')).toMatch(
      /componentProps.*addLabel/
    );
  });

  it('документ кредитной заявки прежнего формата: имена известны реестру с новыми именами', () => {
    const creditV1 = JSON.parse(
      readFileSync(
        fileURLToPath(new URL('../__fixtures__/credit-application.v1.json', import.meta.url)),
        'utf8'
      )
    ) as JsonFormSchema;
    const used = collectOperatorNames(creditV1).components;
    const componentNames = [...used].map((name) => renamedComponentOf(name) ?? name);

    // Фикстура намеренно хранит прежнее имя — иначе проверять здесь было бы нечего.
    expect([...used]).toContain('FormArray');
    expect(componentNames).not.toContain('FormArray');
    expect(validateFormSchema(creditV1, { componentNames }).errors).toEqual([]);
  });
});

describe('рендер: документ с прежним именем компонента', () => {
  interface Phone {
    number: string;
  }
  interface Shape {
    phones: Phone[];
  }

  const render = (arrayComponent: string): string => {
    const model = createModel<Shape>({
      phones: arrayOf((): Phone => ({ number: '' }), [{ number: '111' }, { number: '222' }]),
    });
    const document: JsonFormSchema<Shape> = {
      format: 2,
      root: {
        component: '$component(Box)',
        children: [
          {
            model: '$model(phones)',
            component: `$component(${arrayComponent})`,
            item: { $template: { model: '$model(number)', component: '$component(Input)' } },
          },
        ],
      },
    };
    const bundle = createForm<Shape>({ model, schema: document, registry: createRegistry() });
    return renderToStaticMarkup(<FormRenderer form={bundle} />);
  };

  it('даёт ту же разметку, что и документ с новым именем', () => {
    const html = render('FormArray');

    expect(html).toContain('value="111"');
    expect(html).toContain('value="222"');
    expect(html).toBe(render('FieldArray'));
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
