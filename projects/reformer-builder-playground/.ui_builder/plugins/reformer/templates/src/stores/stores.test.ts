/**
 * Хранилища шаблонов хозяина: каталог проекта и браузер за ОДНИМ интерфейсом.
 *
 * Главная проверка файла — общий набор: один и тот же тест прогоняется по всем хранилищам,
 * которые объявили запись. Пока каждый бэкенд был набором свободных функций с суффиксом
 * в имени (`saveProjectTemplate` / `saveLocalTemplate`), такого теста написать было нельзя —
 * общего у них не было ничего, кроме намерения автора.
 *
 * @module plugins/reformer/templates/stores/stores.test
 */

import { describe, expect, it } from 'vitest';
import type { FormTemplate, TemplateStore } from '../contract';
import { canRemove, canSave, canUpdate } from '../contract';
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
