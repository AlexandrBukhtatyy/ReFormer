import { describe, expect, it } from 'vitest';

import {
  createModuleRegistry,
  isLazyBuiltin,
  isProtectedSpecifier,
  lazyBuiltin,
  ModuleRegistryError,
  PROTECTED_PREFIXES,
  PROTECTED_SPECIFIERS,
} from './registry';

describe('список защищённых спецификаторов', () => {
  it('содержит то, что названо в контракте Э8', () => {
    expect(PROTECTED_SPECIFIERS).toContain('react');
    expect(PROTECTED_SPECIFIERS).toContain('react/jsx-runtime');
    expect(PROTECTED_SPECIFIERS).toContain('@builder/sdk');
    expect(PROTECTED_PREFIXES).toContain('@reformer/');
  });

  it('накрывает любой подпуть @reformer/*', () => {
    expect(isProtectedSpecifier('@reformer/core')).toBe(true);
    expect(isProtectedSpecifier('@reformer/core/validation')).toBe(true);
    expect(isProtectedSpecifier('@reformer/ui-kit/form-wizard')).toBe(true);
  });

  it('не накрывает чужие пакеты', () => {
    expect(isProtectedSpecifier('lodash')).toBe(false);
    expect(isProtectedSpecifier('reformer')).toBe(false);
    // Похоже, но не то: защищён префикс со слэшем, а не всё, что начинается на «@reformer».
    expect(isProtectedSpecifier('@reformer-fake/core')).toBe(false);
  });
});

describe('реестр модулей: резолв', () => {
  it('отдаёт тот же объект, что посадила оболочка', () => {
    const core = { Signal: class {} };
    const registry = createModuleRegistry([['@reformer/core', core]]);

    expect(registry.resolve('@reformer/core', 'form/model.ts')).toBe(core);
  });

  it('отдаёт undefined на неизвестный спецификатор', () => {
    const registry = createModuleRegistry();

    expect(registry.resolve('lodash', 'form/model.ts')).toBeUndefined();
  });

  it('различает подпути: @reformer/core и @reformer/core/validation — разные слоты', () => {
    const core = { tag: 'core' };
    const registry = createModuleRegistry([['@reformer/core', core]]);

    expect(registry.resolve('@reformer/core/validation', 'a.ts')).toBeUndefined();
  });

  it('бросает на путь: пути резолвит линковщик, а не реестр', () => {
    const registry = createModuleRegistry();

    expect(() => registry.resolve('./model', 'form/validation.ts')).toThrowError(
      ModuleRegistryError
    );
    expect(() => registry.resolve('./model', 'form/validation.ts')).toThrowError(
      /form\/validation\.ts/
    );
    expect(() => registry.resolve('/abs/model', 'a.ts')).toThrowError(ModuleRegistryError);
  });
});

describe('реестр модулей: только добавление', () => {
  it('регистрирует чужой модуль и снимает его по dispose', () => {
    const registry = createModuleRegistry();
    const acme = { hello: () => 'мир' };

    const subscription = registry.register('acme-utils', acme);
    expect(registry.resolve('acme-utils', 'plugin/main.ts')).toBe(acme);
    expect(registry.has('acme-utils')).toBe(true);

    subscription.dispose();
    expect(registry.resolve('acme-utils', 'plugin/main.ts')).toBeUndefined();
    // Повторный dispose безвреден — это требование примитива.
    expect(() => subscription.dispose()).not.toThrow();
  });

  it('dispose старой подписки не сносит слот, занятый заново', () => {
    const registry = createModuleRegistry();
    const first = registry.register('acme-utils', { v: 1 });
    first.dispose();

    const second = { v: 2 };
    registry.register('acme-utils', second);
    first.dispose();

    expect(registry.resolve('acme-utils', 'plugin/main.ts')).toBe(second);
  });

  it('ОТКАЗЫВАЕТСЯ подменить защищённый спецификатор — даже когда слот пуст', () => {
    const registry = createModuleRegistry();

    for (const specifier of ['react', 'react/jsx-runtime', '@builder/sdk', '@reformer/core']) {
      const attempt = () => registry.register(specifier, { fake: true });
      expect(attempt, specifier).toThrowError(ModuleRegistryError);
      try {
        attempt();
      } catch (error) {
        expect(error).toBeInstanceOf(ModuleRegistryError);
        expect((error as ModuleRegistryError).reason).toBe('protected');
        expect((error as ModuleRegistryError).specifier).toBe(specifier);
        // Сообщение обязано объяснять причину, а не просто отказывать.
        expect((error as ModuleRegistryError).message).toMatch(/идентичн/i);
      }
      expect(registry.has(specifier)).toBe(false);
    }
  });

  it('ОТКАЗЫВАЕТСЯ подменить защищённый спецификатор, посаженный оболочкой', () => {
    const realCore = { tag: 'настоящее ядро' };
    const registry = createModuleRegistry([['@reformer/core', realCore]]);

    expect(() => registry.register('@reformer/core', { tag: 'подделка' })).toThrowError(
      ModuleRegistryError
    );
    expect(registry.resolve('@reformer/core', 'a.ts')).toBe(realCore);
  });

  it('ОТКАЗЫВАЕТСЯ подменить подпуть защищённого пакета', () => {
    const registry = createModuleRegistry();

    expect(() => registry.register('@reformer/core/signals', {})).toThrowError(/защищённый модуль/);
  });

  it('не даёт двум плагинам занять одно имя: занятый слот — ошибка, а не тихая замена', () => {
    const registry = createModuleRegistry();
    const first = { v: 1 };
    registry.register('acme-utils', first);

    expect(() => registry.register('acme-utils', { v: 2 })).toThrowError(/только добавление/);
    expect(registry.resolve('acme-utils', 'a.ts')).toBe(first);
  });

  it('отклоняет пустой спецификатор', () => {
    const registry = createModuleRegistry();

    expect(() => registry.register('  ', {})).toThrowError(ModuleRegistryError);
  });

  it('падает на противоречивом списке встроенных модулей', () => {
    expect(() =>
      createModuleRegistry([
        ['react', {}],
        ['react', {}],
      ])
    ).toThrowError(/дважды/);
  });

  it('перечисляет известные спецификаторы для сообщений об ошибке', () => {
    const registry = createModuleRegistry([
      ['react', {}],
      ['@reformer/core', {}],
    ]);
    registry.register('acme-utils', {});

    expect(registry.specifiers()).toEqual(['@reformer/core', 'acme-utils', 'react']);
  });
});

describe('реестр модулей: ленивые встроенные', () => {
  it('распознаёт объявление по бренду, а не по форме объекта', () => {
    expect(isLazyBuiltin(lazyBuiltin(async () => ({})))).toBe(true);
    // Настоящий модуль, у которого есть экспорт `load`, ленивым не считается.
    expect(isLazyBuiltin({ load: () => Promise.resolve({}) })).toBe(false);
    expect(isLazyBuiltin(undefined)).toBe(false);
    expect(isLazyBuiltin(null)).toBe(false);
  });

  it('до прогрева ОТКАЗЫВАЕТ причиной cold, а не молчит undefined', () => {
    const registry = createModuleRegistry([
      ['@reformer/ui-kit', lazyBuiltin(async () => ({ Button: 'кнопка' }))],
    ]);

    // Слот занят — иначе «доступные модули» в тексте ошибки линковщика врали бы.
    expect(registry.has('@reformer/ui-kit')).toBe(true);
    expect(registry.specifiers()).toContain('@reformer/ui-kit');
    expect(registry.cold()).toEqual(['@reformer/ui-kit']);

    try {
      registry.resolve('@reformer/ui-kit', 'form/registry.ts');
      expect.unreachable('резолв непрогретого модуля обязан отказать');
    } catch (error) {
      expect(error).toBeInstanceOf(ModuleRegistryError);
      expect((error as ModuleRegistryError).reason).toBe('cold');
      // Чинить надо вызывающего, а не автора формы, — сообщение обязано это назвать.
      expect((error as ModuleRegistryError).message).toMatch(/прогрев/i);
    }
  });

  it('после прогрева отдаёт загруженный модуль и больше не считается холодным', async () => {
    const kit = { Button: 'кнопка' };
    const registry = createModuleRegistry([['@reformer/ui-kit', lazyBuiltin(async () => kit)]]);

    await registry.warm();

    expect(registry.resolve('@reformer/ui-kit', 'form/registry.ts')).toBe(kit);
    expect(registry.cold()).toEqual([]);
  });

  it('грузит каждый модуль один раз: параллельные и повторные прогревы не удваивают import', async () => {
    let calls = 0;
    const registry = createModuleRegistry([
      [
        '@reformer/cdk',
        lazyBuiltin(async () => {
          calls += 1;
          return { Step: 'шаг' };
        }),
      ],
    ]);

    await Promise.all([registry.warm(), registry.warm()]);
    await registry.warm();

    // Второй экземпляр пакета ломает идентичность — ради этого весь механизм и существует.
    expect(calls).toBe(1);
  });

  it('НЕ запоминает отказ: сетевая икота не должна лишать кита навсегда', async () => {
    let attempt = 0;
    const kit = { Button: 'кнопка' };
    const registry = createModuleRegistry([
      [
        '@reformer/ui-kit',
        lazyBuiltin(async () => {
          attempt += 1;
          if (attempt === 1) throw new Error('чанк не доехал');
          return kit;
        }),
      ],
    ]);

    await expect(registry.warm()).rejects.toThrowError(/чанк не доехал/);
    expect(registry.cold()).toEqual(['@reformer/ui-kit']);

    await registry.warm();
    expect(registry.resolve('@reformer/ui-kit', 'a.ts')).toBe(kit);
  });

  it('отказ прогрева называет спецификатор: иначе непонятно, какой чанк не доехал', async () => {
    const registry = createModuleRegistry([
      ['@reformer/ui-kit', lazyBuiltin(() => Promise.reject(new Error('502')))],
    ]);

    await expect(registry.warm()).rejects.toThrowError(/@reformer\/ui-kit/);
  });

  it('прогрев пустого реестра ничего не делает и не падает', async () => {
    const registry = createModuleRegistry([['react', {}]]);

    await expect(registry.warm()).resolves.toBeUndefined();
    expect(registry.cold()).toEqual([]);
  });

  it('ОТКАЗЫВАЕТСЯ регистрировать ленивое через register: прогревать его было бы уже некому', () => {
    const registry = createModuleRegistry();

    const attempt = () =>
      registry.register(
        'acme-utils',
        lazyBuiltin(async () => ({}))
      );
    expect(attempt).toThrowError(ModuleRegistryError);
    try {
      attempt();
    } catch (error) {
      expect((error as ModuleRegistryError).reason).toBe('invalid');
    }
    expect(registry.has('acme-utils')).toBe(false);
  });

  it('прогретый ленивый слот защищён так же, как обычный встроенный', async () => {
    const registry = createModuleRegistry([
      ['@reformer/ui-kit', lazyBuiltin(async () => ({ Button: 'настоящая' }))],
    ]);
    await registry.warm();

    expect(() => registry.register('@reformer/ui-kit', { Button: 'подделка' })).toThrowError(
      /защищённый модуль/
    );
  });
});
