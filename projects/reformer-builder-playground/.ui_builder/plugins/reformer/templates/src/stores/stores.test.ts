/**
 * Хранилища шаблонов: три бэкенда за ОДНИМ интерфейсом.
 *
 * Главная проверка файла — общий набор: один и тот же тест прогоняется по всем хранилищам,
 * которые объявили запись. Пока каждый бэкенд был набором свободных функций с суффиксом
 * в имени (`saveProjectTemplate` / `saveLocalTemplate`), такого теста написать было нельзя —
 * общего у них не было ничего, кроме намерения автора.
 *
 * @module plugins/reformer/templates/stores/stores.test
 */

import { describe, expect, it, vi } from 'vitest';
import { builtinEntries, builtinKit, noWizardKit } from '../../../core/testing';
import {
  apiTemplate,
  barrelTemplate,
  buildView,
  createTemplate,
  entryTemplate,
  makeNames,
  messagesTemplate,
  modelTemplate,
  moduleFilesOf,
  pageTemplate,
  prepare,
  typesTemplate,
} from '../../../core/codegen';
import { collectOperatorNames } from '../../../core/form-model';
import { isGenerated, renderTemplate, withMarker } from '@reformer/builder-toolkit';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { FormTemplate, TemplateFile, TemplateStore } from '../contract';
import { canRemove, canSave, canUpdate } from '../contract';
import { applyTemplate, materializeFiles } from '../content/files';
import {
  BUILTIN_BASE_NAME,
  createBuiltinStore,
  type ModulePrinter,
  type SeedExtras,
} from './builtin';
import { simpleSeed } from './seeds';
import { createLocalStore } from './local';
import { createProjectStore, TEMPLATES_DIR } from './project';
import { createFakeTemplatesHost, createMemoryStorage } from '../testing';

const template = (over: Partial<FormTemplate> = {}): FormTemplate => ({
  id: 'credit-form',
  name: 'Кредитная форма',
  source: 'local',
  files: [{ path: 'model.ts', content: 'export const m = 1;' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

/** Имена и пути модуля под базовое имя — то, что печатник получает и по чему печатает. */
const BASE = makeNames(BUILTIN_BASE_NAME);
const LAYOUT = moduleFilesOf(BASE);

/**
 * Печатник-двойник: шесть файлов в раскладке кодогена, с именами модуля в путях и текстах.
 *
 * Состав подобран по ролям: страница, две части ядра (модель и тип), запись реестра форм,
 * реэкспорты и README — на них и держатся зависимости файлов шаблона.
 */
const printer: ModulePrinter = async () => [
  { path: LAYOUT.page, content: `export default function ${BASE.TypeName}() {}` },
  { path: LAYOUT.model, content: `export const ${BASE.modelFactory} = 1;` },
  { path: LAYOUT.types, content: `export type ${BASE.TypeName} = {};` },
  { path: LAYOUT.entry, content: `export const ${BASE.entryConst} = '${BASE.exampleId}';` },
  { path: LAYOUT.barrel, content: `export { default } from './${BASE.TypeName}';` },
  { path: LAYOUT.readme, content: `# ${BASE.title}` },
];

/** Файлы модуля, как их напечатал бы кодоген для формы с таким именем — НАСТОЯЩИМИ эмиттерами. */
function emitted(schema: JsonFormSchema, formName: string): TemplateFile[] {
  const view = buildView(prepare({ schema, formName, kit: builtinKit() }));
  const files = view.layout.files;
  const stamped = (path: string, key: string, body: string): TemplateFile => ({
    path,
    // Производные файлы кодоген метит маркером происхождения; авторские (`api`) — нет.
    content: withMarker(renderTemplate(`test.builtin.${key}`, body, view)),
  });
  return [
    stamped(files.types, 'types', typesTemplate),
    stamped(files.model, 'model', modelTemplate),
    stamped(files.create, 'create', createTemplate),
    stamped(files.entry, 'entry', entryTemplate),
    stamped(files.page, 'page', pageTemplate),
    stamped(files.barrel, 'barrel', barrelTemplate),
    { path: files.api, content: renderTemplate('test.builtin.api', apiTemplate, view) },
    // Словарь замечаний — авторский, как и запросы: маркера не несёт и не регенерируется.
    {
      path: files.messages,
      content: renderTemplate('test.builtin.messages', messagesTemplate, view),
    },
  ];
}

/** Пути файлов МОДУЛЯ шаблона: всё, кроме фикстуры, — её кодоген не печатает. */
const modulePaths = (template: FormTemplate): string[] =>
  template.files.filter((f) => (f.scope ?? 'form') === 'form').map((f) => f.path);

/**
 * Печатник на НАСТОЯЩИХ эмиттерах домена.
 *
 * Ради него встроенные шаблоны и переписаны: пока это были «рыбы», проверить, что шаблон
 * совпадает с выводом кодогена, было нечем — совпадение держалось на внимательности автора.
 */
const realPrinter: ModulePrinter = async (schema, formName) => emitted(schema, formName);

/** Имена форм, на которых написания имени расходятся с именами кодогена. */
const FORM_NAMES = [
  // Несколько слов: каталог — kebab, тип — PascalCase, запись реестра — camelCase.
  'my form',
  // Кириллица с пробелом: транслитерация участвует в каждом имени.
  'Профиль пользователя',
  // Имя уже оканчивается на `Form`: суффикс типа не удваивается.
  'contact form',
  // Заглавные подряд: `kebab` билдера слова не разбивает.
  'ABCForm',
  'loan-request-2',
];

describe('встроенные шаблоны', () => {
  it('печатаются кодогеном, а не лежат «рыбами»', async () => {
    const store = createBuiltinStore({ print: printer });
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
      return printer(schema, formName);
    };

    const templates = await createBuiltinStore({ print: capturing }).list();

    // Модуль, начинающийся с «Иванова» и выбранного города, пришлось бы первым делом чистить.
    expect(mocks[0]?.model).toMatchObject({ lastName: '', firstName: '', city: '' });
    // А предпросмотру заполненная форма нужна: по ней видно и список, и вычисляемое поле.
    const fixture = templates[0].files.find((f) => f.path === 'fixture.ts');
    expect(fixture?.content).toContain("lastName: 'Иванов',");
  });

  it('напечатанное токенизируется: шаблон параметризован именами модуля', async () => {
    const templates = await createBuiltinStore({ print: printer }).list();
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

  it.each(FORM_NAMES)('«%s»: пути шаблона — те же, что напечатал бы кодоген', async (formName) => {
    const [simple] = await createBuiltinStore({ print: realPrinter }).list();

    // Пути — ПОДСТАНОВКОЙ в пути шаблона: по ним окно создания формы показывает состав, и по
    // ним же текст, напечатанный под имя, находит своё место.
    const files = materializeFiles(simple, modulePaths(simple), formName);

    // Расхождение здесь — это сироты после первой же генерации из билдера: шаблон положил бы
    // `types/myForm.ts`, а кодоген рядом — `types/my-form.ts`.
    const expected = emitted(simpleSeed(), formName);
    expect(files.map((f) => f.path)).toEqual(expected.map((f) => f.path));
    const layout = moduleFilesOf(makeNames(formName));
    expect(files.map((f) => f.path)).toContain(layout.page);
    expect(files.map((f) => f.path)).toContain(layout.types);
  });

  it.each(FORM_NAMES)('«%s»: и тексты те же — байт в байт, вместе с маркером', async (formName) => {
    const [simple] = await createBuiltinStore({ print: realPrinter }).list();

    // Так форму создаёт операция: шаблон печатается под её имя (`applyTemplate`).
    const files = await applyTemplate(simple, modulePaths(simple), formName);

    // Имена, импорты, заголовок, РАСКЛАДКА СТРОК — всё, что кодоген выводит из имени формы,
    // шаблон обязан вывести так же. Сравнение целиком, а не по списку имён: список всегда короче
    // того, что напечатано.
    expect(files).toEqual(emitted(simpleSeed(), formName));
    // Файл обязан остаться «сгенерированным»: «правленный руками» билдер не перегенерирует из
    // правил формы. Авторские файлы (запросы, словарь замечаний) маркера не несут.
    const layout = moduleFilesOf(makeNames(formName));
    const authored = new Set([layout.api, layout.messages]);
    for (const file of files.filter((f) => !authored.has(f.path))) {
      expect(isGenerated(file.content), file.path).toBe(true);
    }
  });

  it('раскладку строк подстановка не переносит — поэтому под имя шаблон печатается', async () => {
    const [simple] = await createBuiltinStore({ print: realPrinter }).list();
    const model = moduleFilesOf(makeNames('my form')).model;
    const textOf = (files: readonly TemplateFile[]): string =>
      files.find((f) => f.path === model)?.content ?? '';
    const oneLine =
      'export function createMyFormModel(initial?: Partial<MyForm>): FormModel<MyForm> {';

    // Под базовое имя сигнатура фабрики модели в строку не помещается и порвана; под короткое
    // имя формы помещается — и кодоген её не рвёт. Подстановка переносит имена, но не перенос.
    const substituted = textOf(materializeFiles(simple, modulePaths(simple), 'my form'));
    expect(substituted).toContain('export function createMyFormModel(\n');
    expect(substituted).not.toContain(oneLine);

    const printed = textOf(await applyTemplate(simple, modulePaths(simple), 'my form'));
    expect(printed).toContain(oneLine);
  });

  it('под имя формы печатается та же затравка тем же печатником', async () => {
    const calls: { name: string; schema: JsonFormSchema; seed: SeedExtras | undefined }[] = [];
    const capturing: ModulePrinter = (schema, formName, seed) => {
      calls.push({ name: formName, schema, seed });
      return realPrinter(schema, formName, seed);
    };
    const [simple] = await createBuiltinStore({ print: capturing }).list();
    const listed = calls.find((call) => call.name === BUILTIN_BASE_NAME);
    calls.length = 0;

    await applyTemplate(simple, modulePaths(simple), 'Профиль пользователя');

    // Один вызов — под имя формы; схема, правила и данные — те, из которых напечатан список.
    // Другая затравка дала бы форму, состав которой расходится с показанным в окне создания.
    expect(calls.map((call) => call.name)).toEqual(['Профиль пользователя']);
    expect(calls[0].schema).toBe(listed?.schema);
    expect(calls[0].seed).toBe(listed?.seed);
  });

  it('печатник отказал под имя формы — форма раскладывается подстановкой, а не пропадает', async () => {
    // Плагин генерации выгрузили между показом списка и созданием формы: печатать под имя нечем.
    // Имена в подстановочном тексте верны — модуль собирается; раскладку поправит форматтер.
    const fading: ModulePrinter = async (schema, formName, seed) => {
      if (formName !== BUILTIN_BASE_NAME) throw new Error('печатника больше нет');
      return realPrinter(schema, formName, seed);
    };
    const [simple] = await createBuiltinStore({ print: fading }).list();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const files = await applyTemplate(simple, modulePaths(simple), 'my form');

    expect(files).toEqual(materializeFiles(simple, modulePaths(simple), 'my form'));
    expect(files.map((f) => f.path)).toEqual(emitted(simpleSeed(), 'my form').map((f) => f.path));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('ни одного следа базового имени не остаётся', async () => {
    const [simple] = await createBuiltinStore({ print: realPrinter }).list();
    const files = materializeFiles(
      simple,
      simple.files.map((f) => f.path),
      'Профиль пользователя'
    );
    const text = files.map((f) => `${f.path}\n${f.content}`).join('\n');

    for (const trace of [BASE.TypeName, BASE.entryConst, BASE.dir, BASE.title, 'TemplateSeed']) {
      expect(text, trace).not.toContain(trace);
    }
    expect(text.toLowerCase()).not.toContain('template seed');
    expect(text.toLowerCase()).not.toContain('templateseed');
  });

  it('зависимости выводятся из фактического состава, а не перечисляются', async () => {
    const templates = await createBuiltinStore({ print: printer }).list();
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
      return printer(schema, formName);
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
    const store = createBuiltinStore({ print: printer, catalog: () => catalog });

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
      print: printer,
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
