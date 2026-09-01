/**
 * Хранилища шаблонов: три бэкенда за ОДНИМ интерфейсом.
 *
 * Главная проверка файла — общий набор: один и тот же тест прогоняется по всем хранилищам,
 * которые объявили запись. Пока каждый бэкенд был набором свободных функций с суффиксом
 * в имени (`saveProjectTemplate` / `saveLocalTemplate`), такого теста написать было нельзя —
 * общего у них не было ничего, кроме намерения автора.
 *
 * @module plugins/templates/stores.test
 */

import { describe, expect, it } from 'vitest';
import { builtinKit } from '@/lib/codegen/__fixtures__/kit';
import {
  buildView,
  typesTemplate,
  indexTemplate,
  makeNames,
  modelTemplate,
  prepare,
  renderTemplate,
} from '@/lib/codegen';
import type { FormTemplate, TemplateStore } from './contract';
import { canRemove, canSave, canUpdate } from './contract';
import { materializeFiles } from './content/files';
import {
  BUILTIN_BASE_NAME,
  createBuiltinStore,
  type ModulePrinter,
  type SeedExtras,
} from './stores/builtin';
import { createLocalStore } from './stores/local';
import { createProjectStore, TEMPLATES_DIR } from './stores/project';
import { createFakeTemplatesHost, createMemoryStorage } from './testing';

const template = (over: Partial<FormTemplate> = {}): FormTemplate => ({
  id: 'credit-form',
  name: 'Кредитная форма',
  source: 'local',
  files: [{ path: 'model.ts', content: 'export const m = 1;' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const printer: ModulePrinter = async () => [
  { path: 'index.tsx', content: 'export default function SamplePage() {}' },
  { path: 'model.ts', content: 'export const createSampleFormModel = 1;' },
  { path: 'README.md', content: '# sample' },
];

/**
 * Печатник на НАСТОЯЩИХ эмиттерах домена.
 *
 * Ради него встроенные шаблоны и переписаны: пока это были «рыбы», проверить, что шаблон
 * совпадает с выводом кодогена, было нечем — совпадение держалось на внимательности автора.
 */
const realPrinter: ModulePrinter = async (schema, formName) => {
  const ctx = prepare({ schema, formName, kit: builtinKit() });
  const view = buildView(ctx);
  return [
    { path: 'types.ts', content: renderTemplate('test.builtin.types', typesTemplate, view) },
    { path: 'model.ts', content: renderTemplate('test.builtin.model', modelTemplate, view) },
    { path: 'index.tsx', content: renderTemplate('test.builtin.index', indexTemplate, view) },
  ];
};

describe('встроенные шаблоны', () => {
  it('печатаются кодогеном, а не лежат «рыбами»', async () => {
    const store = createBuiltinStore({ print: printer });
    const templates = await store.list();
    expect(templates.map((t) => t.id)).toEqual(['builtin-simple-form', 'builtin-wizard-form']);
    // Модуль печатает кодоген; фикстура идёт СВЕРХ его вывода — её адрес лежит вне каталога
    // модуля, и целью генерации она невыразима.
    expect(templates[0].files.map((f) => f.path)).toEqual([
      'index.tsx',
      'model.ts',
      'README.md',
      'fixture.ts',
    ]);
  });

  it('фикстура помечена своим размещением: каталог модуля описан контрактом', async () => {
    const templates = await createBuiltinStore({ print: printer }).list();
    const fixture = templates[0].files.find((f) => f.path === 'fixture.ts');

    expect(fixture?.scope).toBe('fixture');
    // Всё остальное ложится в каталог формы, и это умолчание.
    for (const file of templates[0].files.filter((f) => f.path !== 'fixture.ts')) {
      expect(file.scope ?? 'form', file.path).toBe('form');
    }
  });

  it('фикстура несёт настоящие данные, а не синтезированные option1/2/3', async () => {
    const templates = await createBuiltinStore({ print: printer }).list();
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
      return printer(schema, formName);
    };

    await createBuiltinStore({ print: capturing }).list();

    expect(seen).toHaveLength(2);
    for (const seed of seen) {
      // Без правил кодоген печатает `defineFormBehavior(() => {})` и пустую валидацию.
      expect(seed?.rules?.validation.length ?? 0).toBeGreaterThan(0);
      expect(seed?.rules?.behavior.length ?? 0).toBeGreaterThan(0);
      // Поведение РЕНДЕРА — третий вид правил: видимость принадлежит узлу схемы, а не
      // значению модели, и двумя предыдущими её не выразить.
      expect(seed?.rules?.render.length ?? 0).toBeGreaterThan(0);
      // Без мока `data-sources.ts` уезжает с синтезированными `option1/2/3`.
      expect(seed?.mock?.dataSources).toHaveProperty('CITY_LIST');
    }
  });

  it('напечатанное токенизируется: шаблон параметризован именем формы', async () => {
    const templates = await createBuiltinStore({ print: printer }).list();
    const index = templates[0].files.find((f) => f.path === 'index.tsx');
    expect(index?.content).toBe('export default function __FormName__Page() {}');
  });

  it('круг замыкается: настоящие эмиттеры → токены → имя новой формы', async () => {
    const templates = await createBuiltinStore({ print: realPrinter }).list();
    const files = materializeFiles(
      templates[0],
      templates[0].files.map((f) => f.path),
      'Профиль пользователя'
    );
    const names = makeNames('Профиль пользователя');
    const text = files.map((f) => f.content).join('\n');

    // Имена, выведенные шаблоном, совпадают с тем, что кодоген напечатал бы напрямую.
    expect(text).toContain(names.TypeName);
    expect(text).toContain(names.modelFactory);
    expect(text).toContain(names.pageComponent);
    expect(text).toContain(names.entryConst);
    // И ни одного следа затравочного имени не осталось.
    expect(text).not.toContain('Sample');
    expect(text).not.toContain('sample');
  });

  it('зависимости выводятся из фактического состава, а не перечисляются', async () => {
    const templates = await createBuiltinStore({ print: printer }).list();
    // README не нужен модулю, поэтому точка входа его не тянет.
    expect(templates[0].requires).toEqual({ 'index.tsx': ['model.ts'] });
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
        return printer({} as never, BUILTIN_BASE_NAME);
      },
    });
    expect((await store.list()).map((t) => t.id)).toEqual(['builtin-wizard-form']);
  });

  it('встроенное нельзя ни сохранить, ни переименовать, ни удалить', () => {
    const store = createBuiltinStore({ print: printer });
    expect(canSave(store)).toBe(false);
    expect(canUpdate(store)).toBe(false);
    expect(canRemove(store)).toBe(false);
  });
});

describe('проектные шаблоны', () => {
  it('читаются из каталога проекта вместе с манифестом', async () => {
    const host = createFakeTemplatesHost({
      files: {
        [`project/${TEMPLATES_DIR}/credit/template.json`]: JSON.stringify({
          version: '1.0',
          name: 'Кредит',
          description: 'форма кредита',
        }),
        [`project/${TEMPLATES_DIR}/credit/model.ts`]: 'export const m = 1;',
        [`project/${TEMPLATES_DIR}/credit/ui/x.ts`]: 'export const x = 1;',
      },
    });
    const templates = await createProjectStore(host).list();
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({ id: 'credit', name: 'Кредит', source: 'project' });
    // Манифест — метаданные, а не файл шаблона.
    expect(templates[0].files.map((f) => f.path).sort()).toEqual(['model.ts', 'ui/x.ts']);
  });

  it('без манифеста имя берётся из каталога, а шаблон остаётся читаемым', async () => {
    const host = createFakeTemplatesHost({
      files: { [`project/${TEMPLATES_DIR}/credit/model.ts`]: 'x' },
    });
    expect((await createProjectStore(host).list())[0].name).toBe('credit');
  });

  it('без открытого проекта хранилище недоступно и отдаёт пустой список', async () => {
    const store = createProjectStore(createFakeTemplatesHost({ projectRoot: null }));
    expect(store.available()).toBe(false);
    expect(await store.list()).toEqual([]);
  });

  it('сохранение кладёт манифест рядом с файлами и подбирает свободный slug', async () => {
    const host = createFakeTemplatesHost({
      files: { [`project/${TEMPLATES_DIR}/credit-form/model.ts`]: 'занято' },
    });
    const store = createProjectStore(host);
    const saved = await store.save?.(template({ source: 'project' }), 'credit-form');
    expect(saved?.id).toBe('credit-form-2');
    expect(host.files.has(`project/${TEMPLATES_DIR}/credit-form-2/template.json`)).toBe(true);
    expect(host.files.has(`project/${TEMPLATES_DIR}/credit-form-2/model.ts`)).toBe(true);
  });

  it('переименование правит ТОЛЬКО манифест: каталог и файлы остаются на месте', async () => {
    const host = createFakeTemplatesHost({
      files: {
        [`project/${TEMPLATES_DIR}/credit/template.json`]: '{"version":"1.0","name":"Кредит"}',
        [`project/${TEMPLATES_DIR}/credit/model.ts`]: 'x',
      },
    });
    await createProjectStore(host).update?.(
      template({ id: 'credit', name: 'Новое', source: 'project' })
    );
    expect(host.files.get(`project/${TEMPLATES_DIR}/credit/model.ts`)).toBe('x');
    expect(host.files.get(`project/${TEMPLATES_DIR}/credit/template.json`)).toContain('Новое');
  });

  it('удаление объявляется, ТОЛЬКО если платформа его отдала', () => {
    expect(canRemove(createProjectStore(createFakeTemplatesHost()))).toBe(false);
    expect(canRemove(createProjectStore(createFakeTemplatesHost({ withRemove: true })))).toBe(true);
  });

  it('умеет сохранять и переименовывать даже без удаления — потому и вопросов три', () => {
    const store = createProjectStore(createFakeTemplatesHost());
    expect(canSave(store)).toBe(true);
    expect(canUpdate(store)).toBe(true);
    expect(canRemove(store)).toBe(false);
  });
});

describe('локальные шаблоны', () => {
  it('без движка хранилища объявляют себя недоступными', async () => {
    const store = createLocalStore(undefined);
    expect(store.available()).toBe(false);
    expect(await store.list()).toEqual([]);
  });

  it('вид проставляется при чтении, а не берётся из записи', async () => {
    const storage = createMemoryStorage({ x: { id: 'x', files: [], source: 'project' } });
    expect((await createLocalStore(storage).list())[0].source).toBe('local');
  });

  it('отказ движка даёт пустой список, а не бросок', async () => {
    const broken = createMemoryStorage();
    broken.keys = async () => {
      throw new Error('приватный режим');
    };
    expect(await createLocalStore(broken).list()).toEqual([]);
  });

  it('занятый идентификатор не перезаписывается молча', async () => {
    const store = createLocalStore(
      createMemoryStorage({ 'credit-form': { id: 'credit-form', files: [] } })
    );
    const saved = await store.save?.(template());
    expect(saved?.id).toBe('credit-form-2');
  });
});

describe('общий набор: одинаково для всех, кто объявил запись', () => {
  const backends: ReadonlyArray<{ name: string; make: () => TemplateStore }> = [
    {
      name: 'project',
      make: () => createProjectStore(createFakeTemplatesHost({ withRemove: true })),
    },
    { name: 'local', make: () => createLocalStore(createMemoryStorage()) },
  ];

  for (const backend of backends) {
    describe(backend.name, () => {
      it('сохранённое возвращается списком', async () => {
        const store = backend.make();
        if (!canSave(store)) throw new Error('набор применим только к пишущим хранилищам');
        const saved = await store.save(template({ source: store.source }));
        const listed = await store.list();
        expect(listed.map((t) => t.id)).toContain(saved.id);
      });

      it('вид шаблона совпадает с видом хранилища', async () => {
        const store = backend.make();
        if (!canSave(store)) return;
        const saved = await store.save(template({ source: store.source }));
        expect(saved.source).toBe(store.source);
      });

      it('удалённое исчезает из списка', async () => {
        const store = backend.make();
        if (!canSave(store) || !canRemove(store)) return;
        const saved = await store.save(template({ source: store.source }));
        await store.remove(saved.id);
        expect((await store.list()).map((t) => t.id)).not.toContain(saved.id);
      });
    });
  }
});
