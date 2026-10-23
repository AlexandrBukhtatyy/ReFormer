/**
 * Встроенные шаблоны стека ReFormer: затравки, напечатанные генерацией кода, — без хозяина.
 *
 * Как шаблон раскладывается под имя формы (подстановка и печать под имя), проверяют тесты обеих
 * сторон (`../cross/builtin.test`): раскладывает хозяин.
 *
 * @module plugins/reformer/templates/builtin.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { builtinEntries, noWizardKit } from '../../core/testing';
import { collectOperatorNames } from '../../core/form-model';
import {
  BUILTIN_BASE_NAME,
  createBuiltinStore,
  type ModulePrinter,
  type SeedExtras,
} from './builtin';
import { fakePrinter } from './testing';

describe('встроенные шаблоны', () => {
  it('печатаются кодогеном, а не лежат «рыбами»', async () => {
    const store = createBuiltinStore({ print: fakePrinter });
    const templates = await store.list();
    expect(templates.map((t) => t.id)).toEqual(['builtin-simple-form', 'builtin-wizard-form']);
    // Модуль печатает кодоген — в раскладке «папки по ролям»; имена модуля в путях заменены
    // токенами. Фикстура идёт СВЕРХ его вывода: целью генерации она невыразима.
    expect(templates[0].files.map((f) => f.path)).toEqual([
      '__FormType__.tsx',
      'model/model.ts',
      'types/__form-dir__.ts',
      'application/entry.ts',
      'index.ts',
      'README.md',
      'fixture.ts',
    ]);
  });

  it('фикстура помечена своим размещением: каталог модуля описан контрактом', async () => {
    const templates = await createBuiltinStore({ print: fakePrinter }).list();
    const fixture = templates[0].files.find((f) => f.path === 'fixture.ts');

    expect(fixture?.scope).toBe('fixture');
    // Всё остальное ложится в каталог формы, и это умолчание.
    for (const file of templates[0].files.filter((f) => f.path !== 'fixture.ts')) {
      expect(file.scope ?? 'form', file.path).toBe('form');
    }
  });

  it('фикстура несёт настоящие данные, а не синтезированные option1/2/3', async () => {
    const templates = await createBuiltinStore({ print: fakePrinter }).list();
    const fixture = templates[0].files.find((f) => f.path === 'fixture.ts');

    // Список из трёх безымянных значений показал бы, что механизм работает, но не показал бы,
    // как выглядит форма.
    expect(fixture?.content).toContain('Москва');
    expect(fixture?.content).toContain('CITY_LIST');
    expect(fixture?.content).not.toContain('option1');
  });

  it('затравка несёт правила и данные — иначе проверять в форме нечего', async () => {
    const seen: (SeedExtras | undefined)[] = [];
    const capturing: ModulePrinter = (schema, formName, seed) => {
      seen.push(seed);
      return fakePrinter(schema, formName);
    };

    await createBuiltinStore({ print: capturing }).list();

    expect(seen).toHaveLength(2);
    for (const seed of seen) {
      // Без правил кодоген печатает заготовки поведения и валидации.
      expect(seed?.rules?.validation.length ?? 0).toBeGreaterThan(0);
      expect(seed?.rules?.behavior.length ?? 0).toBeGreaterThan(0);
      // Правила узлов — третий вид правил: видимость принадлежит узлу схемы, а не
      // значению модели, и двумя предыдущими её не выразить.
      expect(seed?.rules?.render.length ?? 0).toBeGreaterThan(0);
      // Без мока файл констант уезжает с синтезированными `option1/2/3`.
      expect(seed?.mock?.dataSources).toHaveProperty('CITY_LIST');
      expect(JSON.stringify(seed?.mock?.dataSources)).not.toContain('option1');
    }
    // Шаги пошаговой формы печатаются каждый в своём файле схемы; простой форме выносить нечего.
    expect(seen.map((seed) => seed?.splitSteps ?? false)).toEqual([false, true]);
  });

  it('начальные значения модуля — пустая форма: значения полей уходят только в фикстуру', async () => {
    const mocks: (SeedExtras['mock'] | undefined)[] = [];
    const capturing: ModulePrinter = (schema, formName, seed) => {
      mocks.push(seed?.mock);
      return fakePrinter(schema, formName);
    };

    const templates = await createBuiltinStore({ print: capturing }).list();

    // Модуль, начинающийся с «Иванова» и выбранного города, пришлось бы первым делом чистить.
    expect(mocks[0]?.model).toMatchObject({ lastName: '', firstName: '', city: '' });
    // А предпросмотру заполненная форма нужна: по ней видно и список, и вычисляемое поле.
    const fixture = templates[0].files.find((f) => f.path === 'fixture.ts');
    expect(fixture?.content).toContain("lastName: 'Иванов',");
  });

  it('вид значения поля — из каталога кита: начальные значения модуля и фикстура ему следуют', async () => {
    const mocks: (SeedExtras['mock'] | undefined)[] = [];
    const capturing: ModulePrinter = (schema, formName, seed) => {
      mocks.push(seed?.mock);
      return fakePrinter(schema, formName);
    };
    // Кит, у которого радиогруппа хранит число: тип значения — в `x-runtimeProps.value.type`, по
    // нему же кодоген печатает тип поля. Без таблицы `options` сделали бы поле строкой — `''`.
    const catalog = builtinEntries().map((entry) => {
      if (entry.name !== 'RadioGroup') return entry;
      const runtime = entry.propsSchema['x-runtimeProps'] ?? {};
      return {
        ...entry,
        propsSchema: {
          ...entry.propsSchema,
          'x-runtimeProps': { ...runtime, value: { ...runtime.value, type: 'number | null' } },
        },
      } as typeof entry;
    });

    const templates = await createBuiltinStore({ print: capturing, catalog: () => catalog }).list();

    expect(mocks[0]?.model).toMatchObject({ gender: null, lastName: '' });
    const fixture = templates[0].files.find((f) => f.path === 'fixture.ts');
    expect(fixture?.content).toContain('gender: null,');
  });

  it('напечатанное токенизируется: шаблон параметризован именами модуля', async () => {
    const templates = await createBuiltinStore({ print: fakePrinter }).list();
    const contentOf = (path: string): string | undefined =>
      templates[0].files.find((f) => f.path === path)?.content;

    expect(contentOf('__FormType__.tsx')).toBe('export default function __FormType__() {}');
    expect(contentOf('model/model.ts')).toBe('export const create__FormType__Model = 1;');
    // Запись реестра — camelCase от типа, идентификатор формы — её каталог: разные токены, и
    // спутать их нельзя, хотя у однословного имени это была бы одна и та же строка.
    expect(contentOf('application/entry.ts')).toBe(
      "export const __formType__Entry = '__form-dir__';"
    );
    expect(contentOf('README.md')).toBe('# __FormTitle__');
  });

  it('зависимости выводятся из фактического состава, а не перечисляются', async () => {
    const templates = await createBuiltinStore({ print: fakePrinter }).list();
    const core = ['model/model.ts', 'types/__form-dir__.ts'];

    expect(templates[0].requires).toEqual({
      // Страница тянет ядро модуля — без него она не соберётся. README ей не нужен.
      '__FormType__.tsx': core,
      // Запись реестра форм собирает форму теми же частями.
      'application/entry.ts': core,
      // Реэкспорты отдают наружу страницу и запись — их и тянут.
      'index.ts': ['__FormType__.tsx', 'application/entry.ts'],
    });
  });

  it('печатник ответил пустотой — шаблона нет: печатать нечем', async () => {
    // Кита нет — генерация кода отвечает пустым списком. Шаблон из одной фикстуры выглядел бы
    // созданной формой, у которой нечего открыть.
    const store = createBuiltinStore({ print: async () => [] });

    expect(await store.list()).toEqual([]);
  });

  it('затравка идёт печатнику уже под кит: компонентов вне каталога в ней нет', async () => {
    const schemas: JsonFormSchema[] = [];
    const capturing: ModulePrinter = (schema, formName) => {
      schemas.push(schema);
      return fakePrinter(schema, formName);
    };
    // Кит без масок, загрузки файлов, массива и визарда.
    const catalog = builtinEntries().filter((entry) =>
      ['Box', 'Section', 'Button', 'Input', 'Select', 'Checkbox'].includes(entry.name)
    );

    const templates = await createBuiltinStore({ print: capturing, catalog: () => catalog }).list();

    // Пошаговой формы нет: собрать её этому киту не из чего.
    expect(templates.map((t) => t.id)).toEqual(['builtin-simple-form']);
    expect(collectOperatorNames(schemas[0]).components.sort()).toEqual(
      ['Box', 'Button', 'Checkbox', 'Input', 'Section', 'Select'].sort()
    );
  });

  it('каталог спрашивается на каждую печать: кит переключают', async () => {
    let catalog = builtinEntries().filter((entry) => ['Box', 'Input'].includes(entry.name));
    const store = createBuiltinStore({ print: fakePrinter, catalog: () => catalog });

    expect((await store.list()).map((t) => t.id)).toEqual(['builtin-simple-form']);
    catalog = builtinEntries();
    expect((await store.list()).map((t) => t.id)).toEqual([
      'builtin-simple-form',
      'builtin-wizard-form',
    ]);
  });

  it('у кита без адаптера визарда пошаговой формы нет, простая остаётся', async () => {
    // Каталог тот же — узлы визарда билдер добавляет к каталогу любого кита. Отличает кит
    // дескриптор: рисовать визард ему нечем.
    const store = createBuiltinStore({
      print: fakePrinter,
      catalog: () => builtinEntries(),
      kit: () => noWizardKit().kit,
    });

    expect((await store.list()).map((t) => t.id)).toEqual(['builtin-simple-form']);
  });

  it('без печатника объявляет себя недоступным, а не отдаёт пустоту молча', async () => {
    const store = createBuiltinStore({});
    expect(store.available()).toBe(false);
    expect(await store.list()).toEqual([]);
  });

  it('отказ печати ОДНОГО шаблона не уносит остальные', async () => {
    let calls = 0;
    const store = createBuiltinStore({
      print: async () => {
        calls += 1;
        if (calls === 1) throw new Error('не напечаталось');
        return fakePrinter({} as never, BUILTIN_BASE_NAME);
      },
    });
    expect((await store.list()).map((t) => t.id)).toEqual(['builtin-wizard-form']);
  });

  it('встроенное нельзя ни сохранить, ни переименовать, ни удалить', () => {
    const store = createBuiltinStore({ print: fakePrinter });
    // Запись выражена ПРИСУТСТВИЕМ методов: у встроенного их нет вовсе.
    expect(store.save).toBeUndefined();
    expect(store.update).toBeUndefined();
    expect(store.remove).toBeUndefined();
  });
});
