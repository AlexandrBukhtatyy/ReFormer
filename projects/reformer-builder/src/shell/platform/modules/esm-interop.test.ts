import { describe, expect, it } from 'vitest';

import { toEsmNamespace } from './esm-interop';

/**
 * Эталон — помощник esbuild, дословно из его CommonJS-вывода для `import()`.
 *
 * Им отложенный импорт собранного плагина оборачивался, пока был `require`; сборщик плагинов
 * вкладывает его же в запасной путь. Хост-функция оболочки обязана отдавать то же самое.
 */
/* eslint-disable */
const __create = Object.create;
const __defProp = Object.defineProperty;
const __getOwnPropDesc = Object.getOwnPropertyDescriptor;
const __getOwnPropNames = Object.getOwnPropertyNames;
const __getProtoOf = Object.getPrototypeOf;
const __hasOwnProp = Object.prototype.hasOwnProperty;
const __copyProps = (to: any, from: any, except?: any, desc?: any) => {
  if ((from && typeof from === 'object') || typeof from === 'function') {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
const __toESM = (mod: any, isNodeMode?: any, target?: any) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, 'default', { value: mod, enumerable: true })
      : target,
    mod
  )
);
/* eslint-enable */

/** Всё, чем пространство имён видно снаружи: прототип, ключи, перечислимость, значения. */
const shape = (namespace: unknown) => {
  const target = namespace as Record<string, unknown>;
  return {
    proto: Object.getPrototypeOf(target) as unknown,
    properties: Object.getOwnPropertyNames(target).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(target, key)?.enumerable,
      target[key],
    ]),
  };
};

describe('пространство имён отложенного импорта', () => {
  const hidden = Object.defineProperty({ visible: 1 }, 'secret', { value: 2, enumerable: false });
  const marked = Object.defineProperty(
    { named: 'экспорт', default: 'по умолчанию' },
    '__esModule',
    {
      value: true,
    }
  );
  const callable = Object.assign(function engine() {}, { version: '1.0.0' });

  const cases: ReadonlyArray<readonly [string, unknown]> = [
    ['модуль, собранный из ESM', marked],
    ['данные — объект', { title: 'Справка', default: 'своё' }],
    ['данные — массив', [1, 2]],
    ['функция с полями', callable],
    ['объект с неперечислимым полем', hidden],
    ['объект без прототипа', Object.assign(Object.create(null) as object, { bare: true })],
    ['строка', 'текст'],
    ['число', 42],
    ['ноль', 0],
    ['null', null],
    ['undefined', undefined],
  ];

  for (const [name, mod] of cases) {
    it(`${name}: то же, что у помощника esbuild`, () => {
      expect(shape(toEsmNamespace(mod))).toEqual(shape(__toESM(mod)));
    });
  }

  it('модуль из ESM отдаёт свои экспорты, прочий — ещё и default', () => {
    expect((toEsmNamespace(marked) as { default: unknown }).default).toBe('по умолчанию');
    expect((toEsmNamespace([1, 2]) as { default: unknown }).default).toEqual([1, 2]);
  });

  it('привязки живые: поздно присвоенный экспорт виден через пространство имён', () => {
    const exports: Record<string, unknown> = { ready: false };
    const namespace = toEsmNamespace(exports) as { ready: boolean };

    exports.ready = true;

    expect(namespace.ready).toBe(true);
  });
});
