/**
 * Операции хозяина шаблонов: создание формы, место новой формы, снимок каталога, переименование,
 * удаление и сводный список — на двойнике стека.
 *
 * С настоящим стеком ReFormer (модуль «папки по ролям», схема прежнего формата) —
 * `../cross/operations.test`.
 *
 * @module plugins/reformer/templates/content/operations.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api';
import type { FormTemplate, TemplateStore } from '../contract';
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
import { createLocalStore } from '../stores/local';
import { createProjectStore, TEMPLATES_DIR } from '../stores/project';
import {
  createFakeTemplateStack,
  createFakeTemplatesHost,
  createMemoryStorage,
  FAKE_DOCUMENT,
} from '../testing';

const PARENT = 'src/forms' as ResourceId;

/** Двойник стека: документ формы — файл {@link FAKE_DOCUMENT}. */
const stacks = [createFakeTemplateStack()];

/** Хранилище только для чтения и недоступное — как встроенное без печатника. */
const readOnly: TemplateStore = { source: 'builtin', available: () => false, list: async () => [] };

const template: FormTemplate = {
  id: 'credit',
  name: 'Кредит',
  source: 'builtin',
  files: [
    { path: FAKE_DOCUMENT, content: '{"format":2,"root":{"component":"$html(div)"}}' },
    { path: 'model.ts', content: 'export const __formName__Model = 1;' },
    { path: 'README.md', content: '# __FormName__' },
  ],
  requires: { 'model.ts': [FAKE_DOCUMENT] },
};

describe('создание формы по шаблону', () => {
  it('пишет отобранные файлы рядом с открытым документом и открывает схему', async () => {
    const host = createFakeTemplatesHost({ stacks });
    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, [
      'model.ts',
      FAKE_DOCUMENT,
    ]);
    expect(result.ok).toBe(true);
    expect(host.files.get('src/forms/Профиль/model.ts')).toBe('export const profilModel = 1;');
    // Операция НАЗЫВАЕТ схему, но не открывает её сама: открытие — решение интерфейса,
    // и команда палитры вправе его не принимать.
    expect(result.openId).toBe(`src/forms/Профиль/${FAKE_DOCUMENT}`);
    expect(host.opened).toEqual([]);
  });

  it('просит дерево забыть уровни: без этого форма создана, но её не видно', async () => {
    // Отказ был ровно здесь: каталог формы создаётся ЗАПИСЬЮ, а не операциями над записями,
    // поэтому дерево оставалось с прошлым листингом родителя — «форма создана» без строки
    // в дереве.
    const host = createFakeTemplatesHost({ stacks });

    await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts', FAKE_DOCUMENT]);

    // Родитель — чтобы появился сам каталог формы; каталог формы — чтобы в нём были файлы.
    expect(host.invalidated).toContain(PARENT);
    expect(host.invalidated).toContain('src/forms/Профиль');
  });

  it('отправка в источник не удалась — это отказ, а не «форма создана»', async () => {
    // Ровно так дефект и выглядел снаружи: сообщение об успехе, а в проекте пусто —
    // файлы остались рабочей копией и не пережили бы перезагрузку.
    const host = { ...createFakeTemplatesHost({ stacks }), save: async () => false };

    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);

    expect(result.ok).toBe(false);
    expect(result.messageKey).toBe('error.save-failed');
  });

  it('порт без отправки в источник — законная сборка, а не отказ', async () => {
    // Отсутствие `save` означает «созданное остаётся рабочей копией» и объявлено контрактом
    // порта; путать его с неудачей отправки нельзя.
    const host = createFakeTemplatesHost({ stacks });

    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);

    expect(result.ok).toBe(true);
  });

  it('перечитывает уровень КАЖДОГО записанного файла, а не только каталога формы', async () => {
    // Правило сформулировано через фактические адреса записи, а не через литералы путей:
    // часть файлов шаблона ложится не в каталог формы (фикстура), и где именно — решает
    // правило размещения. Тест не должен повторять его копией: перечитывание уровней
    // к размещению отношения не имеет и обязано работать при любом.
    const host = createFakeTemplatesHost({ stacks });
    const withFixture = {
      ...template,
      files: [
        ...template.files,
        { path: 'fixture.ts', content: 'export const fixture = {};', scope: 'fixture' as const },
      ],
    };

    await generateFormFromTemplate(host, PARENT, 'Профиль', withFixture, [
      FAKE_DOCUMENT,
      'fixture.ts',
    ]);

    expect(host.files.size).toBeGreaterThan(0);
    for (const path of host.files.keys()) {
      expect(host.invalidated).toContain(host.parentOf(path as ResourceId));
    }
  });

  it('фикстура ложится в каталог формы — рядом со схемой', async () => {
    const host = createFakeTemplatesHost({ stacks });
    const withFixture = {
      ...template,
      files: [
        ...template.files,
        { path: 'fixture.ts', content: 'export const fixture = {};', scope: 'fixture' as const },
      ],
    };

    await generateFormFromTemplate(host, PARENT, 'Профиль', withFixture, [
      FAKE_DOCUMENT,
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
    const host = createFakeTemplatesHost({
      stacks,
      files: { 'src/forms/Профиль/model.ts': 'чужое' },
    });
    const withFixture = {
      ...template,
      files: [
        ...template.files,
        { path: 'fixture.ts', content: 'export const fixture = {};', scope: 'fixture' as const },
      ],
    };

    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', withFixture, [
      FAKE_DOCUMENT,
      'fixture.ts',
    ]);

    expect(result.ok).toBe(true);
    expect(host.files.has('src/forms/Профиль-2/fixture.ts')).toBe(true);
    expect(host.files.has('src/forms/Профиль/fixture.ts')).toBe(false);
  });

  it('зависимости добираются сами: отметили модель — приехала и схема', async () => {
    const host = createFakeTemplatesHost({ stacks });
    await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);
    expect(host.files.has(`src/forms/Профиль/${FAKE_DOCUMENT}`)).toBe(true);
    expect(host.files.has('src/forms/Профиль/README.md')).toBe(false);
  });

  it('занятое имя каталога не перезаписывается молча', async () => {
    const host = createFakeTemplatesHost({
      stacks,
      files: { 'src/forms/Профиль/model.ts': 'чужое' },
    });
    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);
    expect(result.messageKey).toBe('result.generated');
    expect(result.params?.folder).toBe('Профиль-2');
    expect(host.files.get('src/forms/Профиль/model.ts')).toBe('чужое');
  });

  it('источник без записи отказывает названно и ничего не пишет', async () => {
    const host = createFakeTemplatesHost({ stacks, write: false });
    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);
    expect(result).toMatchObject({ ok: false, messageKey: 'error.read-only', openId: null });
    expect(host.files.size).toBe(0);
  });

  it('пустое имя формы и пустой выбор отказывают по-разному', async () => {
    const host = createFakeTemplatesHost({ stacks });
    expect(
      (await generateFormFromTemplate(host, PARENT, '  ', template, ['model.ts'])).messageKey
    ).toBe('error.no-form-name');
    expect((await generateFormFromTemplate(host, PARENT, 'Профиль', template, [])).messageKey).toBe(
      'error.nothing-picked'
    );
  });
});

describe('место модуля и фикстуры — ответы стека', () => {
  const withFixture: FormTemplate = {
    id: 'm',
    name: 'M',
    source: 'project',
    files: [
      { path: `doc/${FAKE_DOCUMENT}`, content: '{}' },
      { path: 'fixture.ts', content: 'export const fixture = {};', scope: 'fixture' },
    ],
  };
  const all = withFixture.files.map((file) => file.path);

  it('фикстура ложится в каталог, который стек вывел из пути документа', async () => {
    const seen: string[] = [];
    const host = createFakeTemplatesHost({
      stacks: [
        createFakeTemplateStack({
          fixtureDirOf: (path) => {
            seen.push(path);
            return 'preview/data';
          },
        }),
      ],
    });

    await generateFormFromTemplate(host, PARENT, 'Анкета', withFixture, all);

    expect(seen).toEqual([`doc/${FAKE_DOCUMENT}`]);
    expect(host.files.has('src/forms/Анкета/preview/data/fixture.ts')).toBe(true);
  });

  it('стек без ответа о фикстуре — фикстура в корне формы', async () => {
    const host = createFakeTemplatesHost({ stacks });

    const result = await generateFormFromTemplate(host, PARENT, 'Анкета', withFixture, all);

    expect(result.openId).toBe(`src/forms/Анкета/doc/${FAKE_DOCUMENT}`);
    expect(host.files.has('src/forms/Анкета/fixture.ts')).toBe(true);
  });

  it('ничей набор — открывать нечего, а форма всё равно создаётся', async () => {
    const host = createFakeTemplatesHost();

    const result = await generateFormFromTemplate(host, PARENT, 'Анкета', withFixture, all);

    expect(result).toMatchObject({ ok: true, openId: null });
    expect(host.files.has('src/forms/Анкета/fixture.ts')).toBe(true);
  });

  it('новую форму предлагают рядом с модулем: на глубину документа, которую назвал стек', () => {
    const host = createFakeTemplatesHost({
      files: {
        'project/forms/a/doc/x.json': '{}',
        'project/forms/b/y.json': '{}',
        'project/forms/z.json': '{}',
        'project/doc/x.json': '{}',
      },
      stacks: [
        createFakeTemplateStack({ id: 'silent' }),
        createFakeTemplateStack({
          moduleDepthOf: (path) =>
            path.endsWith('x.json') ? 1 : path.endsWith('y.json') ? 0 : null,
        }),
      ],
    });
    const at = (path: string): ResourceId => suggestedFolderOf(host, path as ResourceId);

    expect(at('project/forms/a/doc/x.json')).toBe('project/forms');
    expect(at('project/forms/b/y.json')).toBe('project/forms');
    // Модуля нет — рядом с документом.
    expect(at('project/forms/z.json')).toBe('project/forms');
    // Модуль в корне проекта — сам корень: подниматься выше некуда.
    expect(at('project/doc/x.json')).toBe('project');
  });

  it('без стеков модуля нет ни у кого — форма встаёт рядом с документом', () => {
    const host = createFakeTemplatesHost({ files: { 'project/forms/a/doc/x.json': '{}' } });
    expect(suggestedFolderOf(host, 'project/forms/a/doc/x.json' as ResourceId)).toBe(
      'project/forms/a/doc'
    );
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
      readOnly,
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
    const store = readOnly;
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
    const stores = [readOnly, createProjectStore(host), createLocalStore(host.local)];
    const all = await listTemplates(stores);
    expect(all.map((t) => t.source)).toEqual(['project', 'local']);
  });

  it('находит хранилище по виду шаблона', () => {
    const stores = [readOnly, createLocalStore(createMemoryStorage())];
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
