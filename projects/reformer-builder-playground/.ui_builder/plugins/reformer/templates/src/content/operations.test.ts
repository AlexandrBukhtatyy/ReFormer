import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api';
import type { FormTemplate } from '../contract';
import {
  createTemplateFromDirectory,
  generateFormFromTemplate,
  listFolders,
  listTemplates,
  removeTemplate,
  renameTemplate,
  storeOf,
  suggestedFolderOf,
} from './operations';
import { createBuiltinStore } from '../stores/builtin';
import { createLocalStore } from '../stores/local';
import { createProjectStore, TEMPLATES_DIR } from '../stores/project';
import { createFakeTemplatesHost, createMemoryStorage } from '../testing';

const PARENT = 'src/forms' as ResourceId;

const template: FormTemplate = {
  id: 'credit',
  name: 'Кредит',
  source: 'builtin',
  files: [
    { path: 'form.schema.json', content: '{"format":2,"root":{"component":"$html(div)"}}' },
    { path: 'model.ts', content: 'export const __formName__Model = 1;' },
    { path: 'README.md', content: '# __FormName__' },
  ],
  requires: { 'model.ts': ['form.schema.json'] },
};

describe('создание формы по шаблону', () => {
  it('пишет отобранные файлы рядом с открытым документом и открывает схему', async () => {
    const host = createFakeTemplatesHost();
    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, [
      'model.ts',
      'form.schema.json',
    ]);
    expect(result.ok).toBe(true);
    expect(host.files.get('src/forms/Профиль/model.ts')).toBe('export const profilModel = 1;');
    // Операция НАЗЫВАЕТ схему, но не открывает её сама: открытие — решение интерфейса,
    // и команда палитры вправе его не принимать.
    expect(result.openId).toBe('src/forms/Профиль/form.schema.json');
    expect(host.opened).toEqual([]);
  });

  it('просит дерево забыть уровни: без этого форма создана, но её не видно', async () => {
    // Отказ был ровно здесь: каталог формы создаётся ЗАПИСЬЮ, а не операциями над записями,
    // поэтому дерево оставалось с прошлым листингом родителя — «форма создана» без строки
    // в дереве.
    const host = createFakeTemplatesHost();

    await generateFormFromTemplate(host, PARENT, 'Профиль', template, [
      'model.ts',
      'form.schema.json',
    ]);

    // Родитель — чтобы появился сам каталог формы; каталог формы — чтобы в нём были файлы.
    expect(host.invalidated).toContain(PARENT);
    expect(host.invalidated).toContain('src/forms/Профиль');
  });

  it('отправка в источник не удалась — это отказ, а не «форма создана»', async () => {
    // Ровно так дефект и выглядел снаружи: сообщение об успехе, а в проекте пусто —
    // файлы остались рабочей копией и не пережили бы перезагрузку.
    const host = { ...createFakeTemplatesHost(), save: async () => false };

    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);

    expect(result.ok).toBe(false);
    expect(result.messageKey).toBe('error.save-failed');
  });

  it('порт без отправки в источник — законная сборка, а не отказ', async () => {
    // Отсутствие `save` означает «созданное остаётся рабочей копией» и объявлено контрактом
    // порта; путать его с неудачей отправки нельзя.
    const host = createFakeTemplatesHost();

    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);

    expect(result.ok).toBe(true);
  });

  it('перечитывает уровень КАЖДОГО записанного файла, а не только каталога формы', async () => {
    // Правило сформулировано через фактические адреса записи, а не через литералы путей:
    // часть файлов шаблона ложится не в каталог формы (фикстура), и где именно — решает
    // правило размещения. Тест не должен повторять его копией: перечитывание уровней
    // к размещению отношения не имеет и обязано работать при любом.
    const host = createFakeTemplatesHost();
    const withFixture = {
      ...template,
      files: [
        ...template.files,
        { path: 'fixture.ts', content: 'export const fixture = {};', scope: 'fixture' as const },
      ],
    };

    await generateFormFromTemplate(host, PARENT, 'Профиль', withFixture, [
      'form.schema.json',
      'fixture.ts',
    ]);

    expect(host.files.size).toBeGreaterThan(0);
    for (const path of host.files.keys()) {
      expect(host.invalidated).toContain(host.parentOf(path as ResourceId));
    }
  });

  it('фикстура ложится в каталог формы — рядом со схемой', async () => {
    const host = createFakeTemplatesHost();
    const withFixture = {
      ...template,
      files: [
        ...template.files,
        { path: 'fixture.ts', content: 'export const fixture = {};', scope: 'fixture' as const },
      ],
    };

    await generateFormFromTemplate(host, PARENT, 'Профиль', withFixture, [
      'form.schema.json',
      'fixture.ts',
    ]);

    // Адрес считается от пути СХЕМЫ, а не от каталога шаблона: до применения неизвестно,
    // куда ляжет форма.
    expect(host.files.has('src/forms/Профиль/fixture.ts')).toBe(true);
    // Прежнего дерева фикстур больше нет — ничего в него не пишется.
    expect(host.files.has('_generated/reformer/src/forms/Профиль/fixture.ts')).toBe(false);
  });

  it('фикстура едет в занятое имя каталога вместе с модулем', async () => {
    // Каталог `Профиль` занят — форма уезжает в `Профиль-2`, и фикстура обязана уехать с ней:
    // адрес у них теперь общий, и разъехаться они могут только по недосмотру.
    const host = createFakeTemplatesHost({ files: { 'src/forms/Профиль/model.ts': 'чужое' } });
    const withFixture = {
      ...template,
      files: [
        ...template.files,
        { path: 'fixture.ts', content: 'export const fixture = {};', scope: 'fixture' as const },
      ],
    };

    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', withFixture, [
      'form.schema.json',
      'fixture.ts',
    ]);

    expect(result.ok).toBe(true);
    expect(host.files.has('src/forms/Профиль-2/fixture.ts')).toBe(true);
    expect(host.files.has('src/forms/Профиль/fixture.ts')).toBe(false);
  });

  it('зависимости добираются сами: отметили модель — приехала и схема', async () => {
    const host = createFakeTemplatesHost();
    await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);
    expect(host.files.has('src/forms/Профиль/form.schema.json')).toBe(true);
    expect(host.files.has('src/forms/Профиль/README.md')).toBe(false);
  });

  it('занятое имя каталога не перезаписывается молча', async () => {
    const host = createFakeTemplatesHost({ files: { 'src/forms/Профиль/model.ts': 'чужое' } });
    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);
    expect(result.messageKey).toBe('result.generated');
    expect(result.params?.folder).toBe('Профиль-2');
    expect(host.files.get('src/forms/Профиль/model.ts')).toBe('чужое');
  });

  it('источник без записи отказывает названно и ничего не пишет', async () => {
    const host = createFakeTemplatesHost({ write: false });
    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);
    expect(result).toMatchObject({ ok: false, messageKey: 'error.read-only', openId: null });
    expect(host.files.size).toBe(0);
  });

  it('пустое имя формы и пустой выбор отказывают по-разному', async () => {
    const host = createFakeTemplatesHost();
    expect(
      (await generateFormFromTemplate(host, PARENT, '  ', template, ['model.ts'])).messageKey
    ).toBe('error.no-form-name');
    expect((await generateFormFromTemplate(host, PARENT, 'Профиль', template, [])).messageKey).toBe(
      'error.nothing-picked'
    );
  });
});

describe('форма по шаблону в раскладке «папки по ролям»', () => {
  // Так выглядит встроенный шаблон: документ формы в `schema/`, шаги рядом с ним, страница и
  // файлы ролей названы именами модуля, фикстура идёт сверх модуля.
  const moduleTemplate: FormTemplate = {
    id: 'module',
    name: 'Модуль',
    source: 'builtin',
    files: [
      {
        path: 'schema/form.schema.json',
        content: JSON.stringify({
          format: 2,
          root: {
            component: '$component(Wizard)',
            children: [{ $ref: './steps/dannye/form.schema.json' }],
          },
        }),
      },
      {
        path: 'schema/steps/dannye/form.schema.json',
        content: '{"node":{"component":"$component(Step)","children":[]}}',
      },
      { path: '__FormType__.tsx', content: 'export default function __FormType__() {}' },
      { path: 'types/__form-dir__.ts', content: 'export type __FormType__ = {};' },
      { path: 'fixture.ts', content: 'export const fixture = {};', scope: 'fixture' },
    ],
  };
  const all = moduleTemplate.files.map((file) => file.path);

  it('каталог формы — каталог модуля; открывается документ из `schema/`', async () => {
    const host = createFakeTemplatesHost();

    const result = await generateFormFromTemplate(
      host,
      PARENT,
      'loan request',
      moduleTemplate,
      all
    );

    expect(result.ok).toBe(true);
    // Открывается корневой документ формы, а не первый попавшийся файл шага.
    expect(result.openId).toBe('src/forms/loan request/schema/form.schema.json');
    expect([...host.files.keys()].sort()).toEqual(
      [
        'src/forms/loan request/schema/form.schema.json',
        'src/forms/loan request/schema/steps/dannye/form.schema.json',
        // Имена файлов — те, что кодоген напечатал бы для этой формы: тип и kebab-каталог.
        'src/forms/loan request/LoanRequestForm.tsx',
        'src/forms/loan request/types/loan-request.ts',
        'src/forms/loan request/fixture.ts',
      ].sort()
    );
  });

  it('фикстура ложится в корень модуля, а не рядом со схемой в `schema/`', async () => {
    const host = createFakeTemplatesHost();

    await generateFormFromTemplate(host, PARENT, 'loan', moduleTemplate, all);

    // Там её и ищет превью: корень модуля — родитель папки `schema/`.
    expect(host.files.has('src/forms/loan/fixture.ts')).toBe(true);
    expect(host.files.has('src/forms/loan/schema/fixture.ts')).toBe(false);
  });

  it('имя подставляется по каталогу формы: занятое имя не разводит каталог и файлы', async () => {
    // Билдер называет форму именем каталога её модуля. Каталог `loan-2` с файлами под имя
    // `loan` дал бы после первой же генерации из билдера второй набор файлов рядом с первым.
    const host = createFakeTemplatesHost({ files: { 'src/forms/loan/чужое.ts': 'чужое' } });

    const result = await generateFormFromTemplate(host, PARENT, 'loan', moduleTemplate, all);

    expect(result.params?.folder).toBe('loan-2');
    expect(host.files.get('src/forms/loan-2/Loan2Form.tsx')).toBe(
      'export default function Loan2Form() {}'
    );
    expect(host.files.has('src/forms/loan-2/types/loan-2.ts')).toBe(true);
    expect(host.files.has('src/forms/loan-2/LoanForm.tsx')).toBe(false);
  });

  it('шаблон, который печатается, ложится текстом печати — под имя каталога формы', async () => {
    // Встроенный шаблон: раскладка строк модуля зависит от имён, поэтому на диск уходит не
    // подстановка в текст шаблона, а модуль, напечатанный под имя формы. Имя — каталог: занятое
    // `loan` даёт `loan-2`, и печататься обязан модуль `loan-2`.
    const names: string[] = [];
    const printing: FormTemplate = {
      ...moduleTemplate,
      print: async (formName) => {
        names.push(formName);
        return [
          { path: 'Loan2Form.tsx', content: 'export default function Loan2Form(\n) {}' },
          { path: 'types/loan-2.ts', content: 'export type Loan2Form =\n  {};' },
        ];
      },
    };
    const host = createFakeTemplatesHost({ files: { 'src/forms/loan/чужое.ts': 'чужое' } });

    const result = await generateFormFromTemplate(host, PARENT, 'loan', printing, all);

    expect(result.ok).toBe(true);
    expect(names).toEqual(['loan-2']);
    expect(host.files.get('src/forms/loan-2/Loan2Form.tsx')).toBe(
      'export default function Loan2Form(\n) {}'
    );
    expect(host.files.get('src/forms/loan-2/types/loan-2.ts')).toBe(
      'export type Loan2Form =\n  {};'
    );
    // Чего печать не дала (схема, шаг, фикстура), то легло подстановкой: набор файлов — шаблона.
    expect(host.files.has('src/forms/loan-2/schema/form.schema.json')).toBe(true);
    expect(host.files.get('src/forms/loan-2/fixture.ts')).toBe('export const fixture = {};');
    expect(result.openId).toBe('src/forms/loan-2/schema/form.schema.json');
  });
});

describe('куда предложить новую форму', () => {
  const host = createFakeTemplatesHost({
    files: {
      'project/forms/old.json': '{}',
      'project/forms/loan/schema/form.schema.json': '{}',
      'project/forms/contact/form.schema.json': '{}',
      'project/schema/form.schema.json': '{}',
      'project/form.schema.json': '{}',
    },
  });
  const at = (path: string): ResourceId => suggestedFolderOf(host, path as ResourceId);

  it('свободно названный документ — его каталог: он лежит среди форм', () => {
    expect(at('project/forms/old.json')).toBe('project/forms');
  });

  it('документ модуля в `schema/` — каталог рядом с МОДУЛЕМ, а не внутри `schema/`', () => {
    // Форма, созданная в `loan/schema/`, стала бы частью чужого модуля.
    expect(at('project/forms/loan/schema/form.schema.json')).toBe('project/forms');
  });

  it('документ модуля прежней раскладки — тоже рядом с модулем', () => {
    expect(at('project/forms/contact/form.schema.json')).toBe('project/forms');
  });

  it('модуль в корне проекта — сам корень: подниматься выше некуда', () => {
    expect(at('project/schema/form.schema.json')).toBe('project');
    expect(at('project/form.schema.json')).toBe('project');
  });

  it('документ, пути которого порт не знает, — его каталог', () => {
    expect(at('project/forms/loan/schema/unknown.json')).toBe('project/forms/loan/schema');
  });
});

describe('шаблон проекта со схемой прежнего формата', () => {
  // Шаблон лежит в каталоге проекта файлами, и схема в нём могла быть написана до формата 2:
  // привязка в `value`, шаги визарда в `componentProps.steps`. Форма по такому шаблону —
  // новый документ билдера, и на диск он обязан лечь форматом 2.
  const TEMPLATE = `project/${TEMPLATES_DIR}/anketa`;
  const FORM = 'src/forms/Профиль';

  const legacyStep = (title: string, model: string) => ({
    component: '$component(Step)',
    componentProps: { title },
    children: [{ value: `$model(${model})`, component: '$component(Input)' }],
  });
  const step = (title: string, model: string) => ({
    component: '$component(Step)',
    componentProps: { title },
    children: [{ model: `$model(${model})`, component: '$component(Input)' }],
  });

  /** Применить единственный шаблон проекта целиком и отдать записанное. */
  async function apply(files: Record<string, unknown>) {
    const stored = Object.fromEntries(
      Object.entries(files).map(([path, json]) => [`${TEMPLATE}/${path}`, JSON.stringify(json)])
    );
    const host = createFakeTemplatesHost({ files: stored });
    const [found] = await createProjectStore(host).list();
    const result = await generateFormFromTemplate(
      host,
      PARENT,
      'Профиль',
      found,
      found.files.map((f) => f.path)
    );
    const written = (path: string): unknown => JSON.parse(host.files.get(`${FORM}/${path}`) ?? '');
    return { host, stored, result, written };
  }

  it('применяется, а записанная схема — формата 2', async () => {
    const { host, stored, result, written } = await apply({
      'form.schema.json': {
        version: '1.0',
        root: {
          component: '$component(Wizard)',
          componentProps: { steps: [legacyStep('Данные', 'lastName')] },
        },
      },
    });

    expect(result).toMatchObject({ ok: true, openId: `${FORM}/form.schema.json` });
    expect(written('form.schema.json')).toEqual({
      format: 2,
      version: '1.0',
      root: { component: '$component(Wizard)', children: [step('Данные', 'lastName')] },
    });
    // Сам шаблон остаётся как лежал: переводится созданная форма, а не чужой файл проекта.
    for (const [path, text] of Object.entries(stored)) expect(host.files.get(path)).toBe(text);
  });

  it('разбитая по шагам — тоже: и корень со ссылками, и файлы шагов', async () => {
    const { result, written } = await apply({
      'form.schema.json': {
        version: '1.0',
        root: {
          component: '$component(Wizard)',
          componentProps: {
            steps: [
              { $ref: './steps/dannye/form.schema.json' },
              { $ref: './steps/kontakty/form.schema.json' },
            ],
          },
        },
      },
      'steps/dannye/form.schema.json': { node: legacyStep('Данные', 'lastName') },
      'steps/kontakty/form.schema.json': { node: legacyStep('Контакты', 'email') },
    });

    // Открывается корневая схема, а не первый попавшийся файл шага.
    expect(result).toMatchObject({ ok: true, openId: `${FORM}/form.schema.json` });
    expect(written('form.schema.json')).toEqual({
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Wizard)',
        children: [
          { $ref: './steps/dannye/form.schema.json' },
          { $ref: './steps/kontakty/form.schema.json' },
        ],
      },
    });
    expect(written('steps/dannye/form.schema.json')).toEqual({ node: step('Данные', 'lastName') });
    expect(written('steps/kontakty/form.schema.json')).toEqual({ node: step('Контакты', 'email') });
  });
});

describe('сборка шаблона из каталога', () => {
  it('читает каталог рекурсивно, пропускает бинарные и сохраняет в хранилище', async () => {
    const host = createFakeTemplatesHost();
    const store = createLocalStore(createMemoryStorage());
    host.files.set('src/forms/credit/model.ts', 'export const credit = 1;');
    host.files.set('src/forms/credit/ui/x.ts', 'export const x = 1;');
    host.files.set('src/forms/credit/logo.png', 'бинарь');

    const result = await createTemplateFromDirectory(
      host,
      store,
      'src/forms/credit' as ResourceId,
      { name: 'Кредит' }
    );
    expect(result).toMatchObject({ ok: true, messageKey: 'result.created' });
    expect(result.params).toMatchObject({ count: 2, skipped: 1 });

    const saved = (await store.list())[0];
    expect(saved.files.map((f) => f.path).sort()).toEqual(['model.ts', 'ui/x.ts']);
    // Базовое имя выведено из каталога, поэтому имя формы стало плейсхолдером.
    expect(saved.files.find((f) => f.path === 'model.ts')?.content).toBe(
      'export const __formName__ = 1;'
    );
  });

  it('в хранилище без записи не сохраняет и говорит почему', async () => {
    const host = createFakeTemplatesHost();
    const result = await createTemplateFromDirectory(
      host,
      createBuiltinStore({}),
      'src/forms/credit' as ResourceId,
      { name: 'Кредит' }
    );
    expect(result.messageKey).toBe('error.store-read-only');
  });

  it('каталог без текстовых файлов отказывает названно', async () => {
    const host = createFakeTemplatesHost({ files: { 'src/forms/credit/logo.png': 'бинарь' } });
    const result = await createTemplateFromDirectory(
      host,
      createLocalStore(createMemoryStorage()),
      'src/forms/credit' as ResourceId,
      { name: 'Кредит' }
    );
    expect(result.messageKey).toBe('error.nothing-to-save');
  });
});

describe('переименование и удаление', () => {
  it('переименование правит метаданные', async () => {
    const store = createLocalStore(createMemoryStorage());
    const saved = await store.save?.({ ...template, source: 'local' });
    const result = await renameTemplate(store, saved!, 'Новое имя');
    expect(result.ok).toBe(true);
    expect((await store.list())[0].name).toBe('Новое имя');
  });

  it('встроенное не переименовывается и не удаляется', async () => {
    const store = createBuiltinStore({});
    expect((await renameTemplate(store, template, 'x')).messageKey).toBe('error.store-read-only');
    expect((await removeTemplate(store, template)).messageKey).toBe('error.no-remove');
  });

  it('проектное без платформенного удаления отказывает НАЗВАННО, а не молча', async () => {
    const store = createProjectStore(createFakeTemplatesHost());
    expect((await removeTemplate(store, { ...template, source: 'project' })).messageKey).toBe(
      'error.no-remove'
    );
  });
});

describe('сводный список', () => {
  it('собирает шаблоны всех доступных хранилищ и пропускает недоступные', async () => {
    const host = createFakeTemplatesHost({
      files: { [`project/${TEMPLATES_DIR}/credit/model.ts`]: 'x' },
      local: createMemoryStorage({ mine: { id: 'mine', name: 'Мой', files: [] } }),
    });
    const stores = [createBuiltinStore({}), createProjectStore(host), createLocalStore(host.local)];
    const all = await listTemplates(stores);
    expect(all.map((t) => t.source)).toEqual(['project', 'local']);
  });

  it('находит хранилище по виду шаблона', () => {
    const stores = [createBuiltinStore({}), createLocalStore(createMemoryStorage())];
    expect(storeOf(stores, 'local')?.source).toBe('local');
    expect(storeOf(stores, 'project')).toBeNull();
  });
});

describe('каталоги для выбора места формы', () => {
  it('корень идёт первым, вложенные — путями от него', async () => {
    const host = createFakeTemplatesHost({
      files: {
        'project/src/forms/old.json': '{}',
        'project/src/pages/index.tsx': '',
        'project/README.md': '',
      },
    });

    const folders = await listFolders(host, 'project' as ResourceId);

    expect(folders.map((folder) => folder.path)).toEqual(['', 'src', 'src/forms', 'src/pages']);
  });

  it('чужие пакеты и вывод сборки пропускаются вместе с ветвью', async () => {
    // Обход по ним стоит дороже всего проекта, а форму туда не кладут никогда.
    const host = createFakeTemplatesHost({
      files: {
        'project/node_modules/react/index.js': '',
        'project/dist/bundle.js': '',
        'project/src/forms/a.json': '{}',
      },
    });

    const folders = await listFolders(host, 'project' as ResourceId);

    expect(folders.map((folder) => folder.path)).toEqual(['', 'src', 'src/forms']);
  });

  it('предел обхода не превышается', async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < 50; index += 1) files[`project/dir-${index}/file.ts`] = '';
    const host = createFakeTemplatesHost({ files });

    const folders = await listFolders(host, 'project' as ResourceId, 10);

    expect(folders.length).toBe(10);
  });
});
