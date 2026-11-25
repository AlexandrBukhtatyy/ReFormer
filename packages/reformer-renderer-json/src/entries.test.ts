/**
 * Два входа пакета — основной (React) и `neutral` — ведутся двумя ручными списками экспортов.
 * Тест держит их вместе: всё, что не привязано к React, обязано быть в обоих, и одним и тем же
 * значением — иначе реестр, собранный через один вход, не узнавался бы другим.
 */
import { describe, it, expect } from 'vitest';
import * as main from './index';
import * as neutral from './neutral';

/** Есть только в основном входе: компоненты и хуки React. */
const REACT_ONLY = [
  'I18n',
  'LocaleProvider',
  'SchemaErrorBoundary',
  'SchemaErrorPanel',
  'useLocale',
  'useSignalValues',
];

/**
 * Есть в обоих входах, но разными функциями: основной вход подставляет React-границу ошибок
 * (реестр) и уточняет тип результата (конвертер).
 */
const REACT_FLAVOURED = ['composeRegistries', 'convertJsonSchema', 'defineRegistry'];

describe('входы пакета: index и neutral', () => {
  it('основной вход = нейтральный + то, что привязано к React', () => {
    const mainNames = Object.keys(main).sort();
    const neutralNames = Object.keys(neutral).sort();
    expect(mainNames).toEqual([...neutralNames, ...REACT_ONLY].sort());
  });

  it('общие экспорты — одни и те же значения', () => {
    const mainExports = main as Record<string, unknown>;
    const neutralExports = neutral as Record<string, unknown>;
    for (const name of Object.keys(neutral)) {
      if (REACT_FLAVOURED.includes(name)) {
        expect(mainExports[name], name).not.toBe(neutralExports[name]);
      } else {
        expect(mainExports[name], name).toBe(neutralExports[name]);
      }
    }
  });

  it('реестр основного входа и нейтрального — один класс: композиция их смешивает', () => {
    const Component = (): null => null;
    const fromMain = main.defineRegistry((reg) => reg.component('A', Component));
    const fromNeutral = neutral.defineRegistry((reg) => reg.component('B', Component));

    const merged = neutral.composeRegistries(fromNeutral, fromMain);
    expect(merged.names().sort()).toEqual(['A', 'B']);
    // Граница ошибок реестра из основного входа переживает нейтральную композицию.
    const { errorBoundary } = fromMain.resolveSchema!(
      { format: 2, root: { component: '$component(A)' } },
      {} as never
    );
    expect(errorBoundary).toBe(main.SchemaErrorBoundary);
    expect(
      merged.resolveSchema!({ format: 2, root: { component: '$component(A)' } }, {} as never)
        .errorBoundary
    ).toBe(main.SchemaErrorBoundary);
  });
});
