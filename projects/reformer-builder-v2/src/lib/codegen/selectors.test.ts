import { describe, expect, it } from 'vitest';
import { sampleSchema } from '../form-model/__fixtures__/sample-schema';
import { plainSchema, wizardSchema } from './__fixtures__/kit';
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
