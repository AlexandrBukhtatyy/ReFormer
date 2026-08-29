import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@/sdk';
import type { FormTemplate } from './contract';
import {
  createTemplateFromDirectory,
  generateFormFromTemplate,
  listTemplates,
  removeTemplate,
  renameTemplate,
  storeOf,
} from './operations';
import { createBuiltinStore } from './stores/builtin';
import { createLocalStore } from './stores/local';
import { createProjectStore, TEMPLATES_DIR } from './stores/project';
import { createFakeTemplatesHost, createMemoryStorage } from './testing';

const PARENT = 'src/forms' as ResourceId;

const template: FormTemplate = {
  id: 'credit',
  name: 'Кредит',
  source: 'builtin',
  files: [
    { path: 'renderer.schema.json', content: '{"root":{"component":"$html(div)"}}' },
    { path: 'model.ts', content: 'export const __formName__Model = 1;' },
    { path: 'README.md', content: '# __FormName__' },
  ],
  requires: { 'model.ts': ['renderer.schema.json'] },
};

describe('создание формы по шаблону', () => {
  it('пишет отобранные файлы рядом с открытым документом и открывает схему', async () => {
    const host = createFakeTemplatesHost();
    const result = await generateFormFromTemplate(host, PARENT, 'Профиль', template, [
      'model.ts',
      'renderer.schema.json',
    ]);
    expect(result.ok).toBe(true);
    expect(host.files.get('src/forms/Профиль/model.ts')).toBe('export const profilModel = 1;');
    // Операция НАЗЫВАЕТ схему, но не открывает её сама: открытие — решение интерфейса,
    // и команда палитры вправе его не принимать.
    expect(result.openId).toBe('src/forms/Профиль/renderer.schema.json');
    expect(host.opened).toEqual([]);
  });

  it('зависимости добираются сами: отметили модель — приехала и схема', async () => {
    const host = createFakeTemplatesHost();
    await generateFormFromTemplate(host, PARENT, 'Профиль', template, ['model.ts']);
    expect(host.files.has('src/forms/Профиль/renderer.schema.json')).toBe(true);
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
