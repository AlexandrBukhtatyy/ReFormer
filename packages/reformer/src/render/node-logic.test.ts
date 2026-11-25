import { describe, expect, it, vi } from 'vitest';
import { createModel } from '../model/create-model';
import type { CompiledChild } from '../form/schema/compiled';
import {
  VOID_HTML_TAGS,
  fieldTestId,
  formIndexOf,
  joinTextParts,
  mergeNodeProps,
  needsControl,
  nodesOnly,
  overrideWithEvents,
  primaryIssue,
  signalPropKeys,
  splitFieldProps,
  stableKey,
  unwrapSignalProps,
  withComponentEvents,
} from '../render';

describe('пропсы узла', () => {
  it('без наложений возвращает объект схемы той же ссылкой', () => {
    const base = { title: 'Адрес' };

    expect(mergeNodeProps(base, undefined, null)).toBe(base);
    expect(mergeNodeProps(undefined, undefined, undefined)).toEqual({});
  });

  it('приоритет: схема → нода формы → поведение', () => {
    const merged = mergeNodeProps(
      { title: 'схема', hint: 'схема', tone: 'схема' },
      { hint: 'нода', tone: 'нода' },
      { tone: 'поведение' }
    );

    expect(merged).toEqual({ title: 'схема', hint: 'нода', tone: 'поведение' });
  });

  it('сигналы модели в пропсах разворачиваются в значения', () => {
    const model = createModel({ kind: 'a', tags: ['ru'] });
    const props = { title: model.$.kind, items: model.$.tags, tone: 'info' };

    expect(signalPropKeys(props)).toEqual(['title', 'items']);
    expect(unwrapSignalProps(props)).toEqual({ title: 'a', items: ['ru'], tone: 'info' });
  });

  it('пропсы без сигналов возвращаются той же ссылкой', () => {
    const props = { tone: 'info' };

    expect(unwrapSignalProps(props)).toBe(props);
    expect(unwrapSignalProps(undefined)).toBeUndefined();
  });

  it('служебные ключи поля отделяются от пропсов контрола', () => {
    const wrapper = () => null;
    const own = splitFieldProps({
      className: 'wide',
      wrapper: 'label',
      fieldWrapper: wrapper,
      testId: 'city',
      placeholder: 'Город',
    });

    expect(own).toEqual({
      className: 'wide',
      wrapper: 'label',
      fieldWrapper: wrapper,
      testId: 'city',
      rest: { placeholder: 'Город' },
    });
    expect(splitFieldProps({ className: 5 }).className).toBeUndefined();
  });

  it('testId: явный главнее, иначе путь поля через дефис', () => {
    expect(fieldTestId('custom', 'rows.0.name')).toBe('custom');
    expect(fieldTestId(undefined, 'rows.0.name')).toBe('rows-0-name');
    expect(fieldTestId(undefined, '')).toBeUndefined();
  });

  it('нода формы нужна контролу только по явному запросу', () => {
    const Plain = (): null => null;
    const Asking = Object.assign((): null => null, { reformerNeedsControl: true });

    expect(needsControl(undefined, Plain)).toBe(false);
    expect(needsControl({ passControl: true }, Plain)).toBe(true);
    expect(needsControl(undefined, Asking)).toBe(true);
    expect(needsControl(undefined, 'input')).toBe(false);
  });
});

describe('колбэки onComponentEvent', () => {
  it('у узла с привязкой колбэк идёт после своего обработчика, результат — колбэка', () => {
    const log: string[] = [];
    const own = vi.fn(() => {
      log.push('свой');
      return 'свой';
    });
    const callback = vi.fn(() => {
      log.push('колбэк');
      return 'колбэк';
    });
    const props = withComponentEvents({ onAdd: own }, new Map([['onAdd', callback]]));

    expect((props.onAdd as (index: number) => unknown)(3)).toBe('колбэк');
    expect(log).toEqual(['свой', 'колбэк']);
    expect(own).toHaveBeenCalledWith(3);
    expect(callback).toHaveBeenCalledWith(3);
  });

  it('событие без своего обработчика получает колбэк как есть', () => {
    const callback = (): void => {};
    const props = withComponentEvents({}, new Map([['onFocus', callback]]));

    expect(props.onFocus).toBe(callback);
  });

  it('у контейнера колбэк главнее пропса схемы с тем же именем', () => {
    const fromSchema = (): void => {};
    const callback = (): void => {};
    const props = overrideWithEvents(
      { onSubmit: fromSchema, title: 'Форма' },
      new Map([['onSubmit', callback]])
    );

    expect(props).toEqual({ onSubmit: callback, title: 'Форма' });
  });

  it('без колбэков пропсы возвращаются той же ссылкой', () => {
    const props = { title: 'Форма' };

    expect(withComponentEvents(props, undefined)).toBe(props);
    expect(overrideWithEvents(props, new Map())).toBe(props);
  });
});

describe('строки массива', () => {
  it('ключ строки держится за под-модель, у примитива — каждый раз новый', () => {
    const row = { name: 'a' };

    expect(stableKey(row)).toBe(stableKey(row));
    expect(stableKey({ name: 'a' })).not.toBe(stableKey(row));
    expect(stableKey('a')).not.toBe(stableKey('a'));
  });

  it('индекс строки формы считает только непустые элементы модели', () => {
    const items = [{ id: 0 }, null, { id: 2 }, { id: 3 }];
    const control = { at: (index: number) => items[index] };

    expect(formIndexOf(control, 0)).toBe(0);
    expect(formIndexOf(control, 1)).toBeUndefined();
    expect(formIndexOf(control, 2)).toBe(1);
    expect(formIndexOf(control, 3)).toBe(2);
  });
});

describe('текст и теги', () => {
  it('части текста склеиваются, сигнал читается, пустое значение — пустая строка', () => {
    const model = createModel<{ payment: number | null }>({ payment: 30000 });

    expect(joinTextParts(['Платёж: ', model.$.payment, ' ₽'])).toBe('Платёж: 30000 ₽');

    model.patch({ payment: null });
    expect(joinTextParts(['Платёж: ', model.$.payment, ' ₽'])).toBe('Платёж:  ₽');
  });

  it('из детей остаются узлы, текстовые части считаются', () => {
    const node = { kind: 'container' } as CompiledChild;
    const text = { kind: 'text' } as CompiledChild;

    expect(nodesOnly([text, node, text])).toEqual({ nodes: [node], dropped: 2 });
  });

  it('теги без содержимого известны рендереру', () => {
    expect(VOID_HTML_TAGS.has('hr')).toBe(true);
    expect(VOID_HTML_TAGS.has('div')).toBe(false);
  });
});

describe('главное замечание', () => {
  it('ошибка главнее предупреждения, стоящего раньше', () => {
    const warning = { code: 'soft', severity: 'warning' as const };
    const error = { code: 'required' };

    expect(primaryIssue([warning, error])).toBe(error);
    expect(primaryIssue([warning])).toBe(warning);
    expect(primaryIssue([])).toBeUndefined();
  });
});
