import { describe, expect, it } from 'vitest';
import { sampleSchema } from '../form-model/__fixtures__/sample-schema';
import { partsSchema, plainSchema, wizardSchema } from './__fixtures__/kit';
import { assignSelectors } from './selectors';

describe('assignSelectors', () => {
  it('не трогает исходную схему: селекторы проставляются на копии', () => {
    const input = plainSchema();
    const before = JSON.stringify(input);
    assignSelectors(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('секция с подписью получает селектор и попадает в отчёт', () => {
    const { info } = assignSelectors(plainSchema());
    expect(info.sections).toEqual([{ selector: 'lichnye-dannye-section', label: 'Личные данные' }]);
  });

  it('вставляет кнопку отправки, если триггера в схеме не было', () => {
    const { schema, info } = assignSelectors(plainSchema());
    expect(info.injectedSubmit).toBe(true);
    expect(info.submitEvent).toBe('onClick');
    const children = (schema.root as { children: { selector?: string }[] }).children;
    expect(children.at(-1)?.selector).toBe(info.submitSelector);
  });

  it('подпись вставленной кнопки лежит в children узла, а не в componentProps', () => {
    // `componentProps.children` рендерер затирает содержимым `children[]` узла — кнопка
    // выходила пустым (чёрным) прямоугольником.
    const { schema } = assignSelectors(plainSchema());
    // Через `unknown`: `JsonChild` не индексируемая запись, и прямое сужение tsc отвергает.
    const children = (schema.root as unknown as { children: Record<string, unknown>[] }).children;
    const submit = children.at(-1)!;
    expect(submit.children).toEqual(['Отправить']);
    expect(submit.componentProps).toEqual({ type: 'submit' });
  });

  it('визард отправляет форму сам: событие onSubmit и никакой вставленной кнопки', () => {
    const { info } = assignSelectors(wizardSchema());
    expect(info.injectedSubmit).toBe(false);
    expect(info.submitEvent).toBe('onSubmit');
    expect(info.submitSelector).toBe('wizard');
  });

  it('сохраняет пользовательские селекторы и дедуплицирует поверх них', () => {
    const { schema, info } = assignSelectors(sampleSchema());
    expect(info.arrays.map((a) => a.selector)).toContain('properties-array');
    // Селектор из схемы остался на месте — экспорт не переименовывает адреса правил.
    const json = JSON.stringify(schema);
    expect(json).toContain('"properties-array"');
  });

  it('шаг без заголовка тоже получает селектор — им шаг называется в потоке', () => {
    // Отказ, который это удерживает: селектор получал только шаг с заголовком, и поток шагов
    // (`flow.steps[].id` — селектор узла шага) не находил разметку безымянного шага.
    const schema = wizardSchema();
    const wizard = (schema.root as unknown as { children: { children: unknown[] }[] }).children[0]!;
    wizard.children.push({
      component: '$component(Step)',
      children: [{ model: '$model(note)', component: '$component(Input)' }],
    });

    const { schema: out, info } = assignSelectors(schema);
    const steps = (out.root as unknown as { children: { children: { selector?: string }[] }[] })
      .children[0]!.children;
    // Шаг с заголовком называется по-прежнему — существующие имена не меняются.
    expect(steps.map((step) => step.selector)).toEqual(['shag-1-section', 'step-2']);
    // Секцией безымянный шаг не становится: заготовка `hideWhen` ему не печатается.
    expect(info.sections.map((s) => s.selector)).toEqual(['shag-1-section']);
  });

  it('селектор шага, заданный в схеме, сохраняется', () => {
    const schema = wizardSchema();
    const wizard = (schema.root as unknown as { children: { children: { selector?: string }[] }[] })
      .children[0]!;
    wizard.children[0]!.selector = 'my-step';

    const { schema: out } = assignSelectors(schema);
    const steps = (out.root as unknown as { children: { children: { selector?: string }[] }[] })
      .children[0]!.children;
    expect(steps[0]?.selector).toBe('my-step');
  });

  it('форму с шагами отправляет визард, даже если кнопка стоит в схеме раньше', () => {
    // Последний шаг визарда рисует свою кнопку отправки; обработчик на чужой кнопке оставил бы
    // её без действия. И раскладка валидации на это опирается: у визарда нет набора «все правила
    // формы», которым кнопка проверяла бы форму сама.
    const schema = wizardSchema();
    (schema.root as unknown as { children: unknown[] }).children.unshift({
      component: '$component(Button)',
      children: ['Справка'],
    });

    const { info } = assignSelectors(schema);
    expect(info.submitEvent).toBe('onSubmit');
    expect(info.submitSelector).toBe('wizard');
  });

  it('второй узел с тем же именем получает суффикс', () => {
    const schema = plainSchema();
    (schema.root as { children: unknown[] }).children.push({
      component: '$component(Box)',
      componentProps: { title: 'Личные данные' },
      children: [],
    });
    const { info } = assignSelectors(schema);
    expect(info.sections.map((s) => s.selector)).toEqual([
      'lichnye-dannye-section',
      'lichnye-dannye-section-2',
    ]);
  });
});

describe('именованные части документа', () => {
  it('текст частей не меняется: селекторы там только читаются', () => {
    const input = partsSchema();
    const { schema } = assignSelectors(input);
    expect(schema.parts).toEqual(input.parts);
    // Дерево корня при этом получает своё: кнопка отправки дописана.
    expect(JSON.stringify(schema.root)).not.toBe(JSON.stringify(input.root));
  });

  it('секция и массив части с селектором автора попадают в отчёт; без селектора — нет', () => {
    const input = partsSchema();
    const address = (input.parts as Record<string, { children: unknown[] }>).address;
    address.children.push(
      {
        selector: 'address-extra',
        component: '$component(Section)',
        componentProps: { title: 'Дополнительно' },
        children: [],
      },
      { component: '$component(Section)', componentProps: { title: 'Без адреса' }, children: [] },
      { selector: 'address-phones', model: '$model(phones)', item: { $template: {} } }
    );
    const { schema, info } = assignSelectors(input);
    expect(info.sections).toEqual([
      { selector: 'work-section', label: 'Рабочий адрес' },
      { selector: 'address-extra', label: 'Дополнительно' },
    ]);
    expect(info.arrays).toEqual([
      { selector: 'guests', path: 'guests' },
      { selector: 'address-phones', path: 'phones' },
    ]);
    expect(schema.parts).toEqual(input.parts);
  });

  it('имя, занятое в части, узлу корня не выдаётся', () => {
    const input = partsSchema();
    const address = (input.parts as Record<string, { children: unknown[] }>).address;
    address.children.push({ selector: 'submit', component: '$component(Box)', children: [] });
    expect(assignSelectors(input).info.submitSelector).toBe('submit-2');
  });
});
