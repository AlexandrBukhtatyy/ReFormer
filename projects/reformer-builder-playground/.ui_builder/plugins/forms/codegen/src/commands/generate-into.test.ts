/**
 * Генерация в каталог у хозяина: выбор стека, отбор цели, запись, отказы и их слова.
 *
 * Стек подставной — двойник печатает то, что ему велели. Проверяется то, чем владеет хозяин:
 * у кого он спрашивает форму, что записывает и что об этом говорит. Прогон через настоящий стек
 * ReFormer — в `reformer/integration/codegen-generate-into.test`.
 *
 * @module plugins/forms/codegen/commands/generate-into.test
 */

import { describe, expect, it } from 'vitest';
import {
  pluginMessageKey,
  type CodegenTarget,
  type NotificationsService,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import {
  generateInto,
  generateIntoArgs,
  notifyOutcome,
  type GenerateIntoOutcome,
} from './generate-into';
import { CODEGEN_PLUGIN_ID } from '../contract';
import type { DeliveryResult } from '../pipeline/deliver';
import { createFakeHost, createFakeStack, stacksOf, type FakeStackOptions } from '../testing';
import type { StackEntry } from '../stacks';

const DIR = 'fake:forms/credit' as ResourceId;

const TARGETS: readonly CodegenTarget[] = [
  { id: 'fake.types', path: 'types.ts', cls: 'derived', template: '', stack: 'fake' },
  { id: 'fake.model', path: 'model.ts', cls: 'derived', template: '', stack: 'fake' },
];
const targets = () => TARGETS;

function setup(stack: FakeStackOptions = { find: 'form', root: DIR }) {
  const host = createFakeHost();
  const fake = createFakeStack(stack);
  return { host, fake, deps: { host, stacks: stacksOf(fake), targets } };
}

describe('генерация в каталог', () => {
  it('форму ищет стек, хозяин пишет весь модуль в корень, который назвал стек', async () => {
    const { host, fake, deps } = setup();
    const outcome = await generateInto(deps, { dir: DIR });

    expect(outcome).toMatchObject({ kind: 'delivered', formName: 'demo' });
    expect(host.written.has(`${DIR}/types.ts`)).toBe(true);
    expect(host.written.has(`${DIR}/model.ts`)).toBe(true);
    expect(fake.readers).toEqual([host]);
  });

  it('одна цель: печатается весь модуль, записывается отобранное', async () => {
    const { host, fake, deps } = setup();
    await generateInto(deps, { dir: DIR, targetId: 'fake.model' });

    expect(fake.printed[0].targets.map((t) => t.id)).toEqual(['fake.types', 'fake.model']);
    expect([...host.written.keys()]).toEqual([`${DIR}/model.ts`]);
  });

  it('имя формы — из аргумента, а без него — от стека', async () => {
    const named = setup();
    await generateInto(named.deps, { dir: DIR, formName: ' credit-application ' });
    expect(named.fake.printed[0].formName).toBe('credit-application');

    const fallback = setup();
    await generateInto(fallback.deps, { dir: DIR });
    expect(fallback.fake.printed[0].formName).toBe('demo');
  });

  it('названный стек спрашивается один; без имени — первый, нашедший форму', async () => {
    const host = createFakeHost();
    const silent = createFakeStack({ id: 'silent', find: null });
    const other = createFakeStack({ id: 'other', find: 'form', root: DIR });
    const deps = { host, stacks: stacksOf(silent, other), targets };

    expect(await generateInto(deps, { dir: DIR })).toMatchObject({
      kind: 'delivered',
      stack: { stack: other },
    });
    expect(await generateInto(deps, { dir: DIR, stack: 'silent' })).toEqual({ kind: 'no-schema' });
    // Стек без `find` из дерева не генерирует — и формы у него нет.
    const blind = createFakeStack({ id: 'blind' });
    expect(await generateInto({ host, stacks: stacksOf(blind), targets }, { dir: DIR })).toEqual({
      kind: 'no-schema',
    });
  });

  it('цель, не применившаяся к форме, названа, а не пропущена молча', async () => {
    const { deps } = setup({ find: 'form', root: DIR, files: [] });
    expect(await generateInto(deps, { dir: DIR, targetId: 'fake.types' })).toEqual({
      kind: 'not-applicable',
      targetId: 'fake.types',
    });
  });

  it('отказы названы: нет каталога, нет листинга, нет формы, источник только для чтения', async () => {
    const { deps } = setup({ find: null });
    expect((await generateInto(deps, {})).kind).toBe('no-directory');
    expect((await generateInto(deps, { dir: DIR })).kind).toBe('no-schema');

    const noListing = createFakeHost();
    expect(
      (await generateInto({ ...deps, host: { ...noListing, list: undefined } }, { dir: DIR })).kind
    ).toBe('no-listing');

    const readOnly = createFakeHost({ write: false });
    const found = setup();
    expect((await generateInto({ ...found.deps, host: readOnly }, { dir: DIR })).kind).toBe(
      'read-only'
    );
  });

  it('отказ стека — до печати и перед записью — доезжает до исхода как был', async () => {
    const refusal = { refusal: { key: 'error.no-kit' } };
    const early = setup({ find: refusal });
    expect(await generateInto(early.deps, { dir: DIR })).toMatchObject({
      kind: 'refused',
      refusal,
    });

    const check = { refusal: { key: 'error.kit-mismatch' } };
    const late = setup({ find: 'form', root: DIR, check });
    expect(await generateInto(late.deps, { dir: DIR })).toMatchObject({
      kind: 'refused',
      refusal: check,
    });
    expect(late.host.written.size).toBe(0);
  });

  it('аргументы проверяются по полю, а не приводятся целиком', () => {
    expect(generateIntoArgs({ dir: DIR, targetId: 'fake.types', stack: 'reformer' })).toEqual({
      dir: DIR,
      targetId: 'fake.types',
      formName: undefined,
      stack: 'reformer',
    });
    expect(generateIntoArgs({ dir: 42, targetId: null, stack: 7 })).toEqual({
      dir: undefined,
      targetId: undefined,
      formName: undefined,
      stack: undefined,
    });
    expect(generateIntoArgs('не объект')).toEqual({
      dir: undefined,
      targetId: undefined,
      formName: undefined,
      stack: undefined,
    });
  });
});

describe('исход говорится словами', () => {
  function sink() {
    const calls: { level: string; key: string; params?: unknown }[] = [];
    const record =
      (level: string) =>
      (key: string, options?: { params?: unknown }): never =>
        calls.push({ level, key, params: options?.params }) as never;
    const notifications = {
      info: record('info'),
      success: record('success'),
      warning: record('warning'),
      error: record('error'),
      show: (request: { messageKey: string }): never =>
        calls.push({ level: 'show', key: request.messageKey }) as never,
      pending: () => [],
      dismiss: () => undefined,
      observe: () => ({ dispose: () => undefined }),
    } as unknown as NotificationsService;
    return { calls, notifications };
  }

  const entry: StackEntry = { stack: createFakeStack(), pluginId: 'fake.plugin' };
  const own = (key: string) => pluginMessageKey(CODEGEN_PLUGIN_ID, key);
  const delivery = (over: Partial<DeliveryResult> = {}): DeliveryResult => ({
    dir: DIR,
    written: [],
    skipped: [],
    failed: [],
    saved: null,
    legacy: [],
    notes: [],
    ...over,
  });

  it('о каждом исходе хозяина, включая «ничего не записал»', () => {
    const cases: readonly [GenerateIntoOutcome, string, string][] = [
      [{ kind: 'no-schema' }, 'warning', own('notify.no-schema')],
      [{ kind: 'not-applicable', targetId: 'fake.flow' }, 'info', own('notify.not-applicable')],
      [{ kind: 'read-only' }, 'error', own('notify.read-only')],
      [
        { kind: 'delivered', formName: 'credit', delivery: delivery(), stack: entry },
        'info',
        own('notify.nothing-written'),
      ],
      [
        {
          kind: 'delivered',
          formName: 'credit',
          delivery: delivery({ written: ['types.ts'], saved: true }),
          stack: entry,
        },
        'success',
        own('notify.written'),
      ],
    ];

    for (const [outcome, level, key] of cases) {
      const { calls, notifications } = sink();
      notifyOutcome(notifications, outcome);
      expect(calls).toEqual([expect.objectContaining({ level, key })]);
    }
  });

  it('отказ стека — ключом ЕГО словаря; с подробностью — «не удалось» его словами', () => {
    const plain = sink();
    notifyOutcome(plain.notifications, {
      kind: 'refused',
      stack: entry,
      refusal: { refusal: { key: 'error.kit-mismatch', params: { module: 'a', active: 'b' } } },
    });
    expect(plain.calls).toEqual([
      {
        level: 'error',
        key: pluginMessageKey('fake.plugin', 'error.kit-mismatch'),
        params: { module: 'a', active: 'b' },
      },
    ]);

    const detailed = sink();
    notifyOutcome(detailed.notifications, {
      kind: 'refused',
      stack: entry,
      refusal: { refusal: { key: 'error.step-parts' }, detail: 'нет файла шага' },
    });
    expect(detailed.calls).toEqual([
      {
        level: 'error',
        key: own('notify.failed'),
        params: { message: 'error.step-parts нет файла шага' },
      },
    ]);
  });

  it('прежнее имя и заметки стека — отдельные предупреждения; у прежнего имени — «открыть»', () => {
    const shown: { key: string; action?: { titleKey: string; run(): void } }[] = [];
    const record = (key: string, options?: { action?: { titleKey: string; run(): void } }) =>
      shown.push({ key, action: options?.action }) as never;
    const notifications = {
      info: record,
      success: record,
      warning: record,
      error: record,
    } as unknown as NotificationsService;
    const opened: string[] = [];
    notifyOutcome(
      notifications,
      {
        kind: 'delivered',
        formName: 'credit',
        stack: entry,
        delivery: delivery({
          written: ['schema/form.schema.json'],
          legacy: [
            {
              path: 'schema/renderer.schema.json',
              replacedBy: 'schema/form.schema.json',
              carried: false,
            },
          ],
          notes: [
            {
              id: 'orphans',
              paths: ['validation/old.ts'],
              title: { key: 'orphans.title' },
              detail: { key: 'orphans.detail' },
              notify: { key: 'notify.orphans', params: { count: 1 } },
            },
          ],
        }),
      },
      {
        resolve: (dir, ...segments) => [dir, ...segments].join('/') as ResourceId,
        openResource: (id) => opened.push(id),
      }
    );
    expect(shown.map((n) => n.key)).toEqual([
      own('notify.legacy'),
      pluginMessageKey('fake.plugin', 'notify.orphans'),
      own('notify.written'),
    ]);
    // Действие открывает новый файл там, где он лежит.
    expect(shown[0]?.action?.titleKey).toBe(own('notify.legacy.open'));
    shown[0]?.action?.run();
    expect(opened).toEqual([`${DIR}/schema/form.schema.json`]);
    expect(shown[1]?.action).toBeUndefined();
  });

  it('без сервиса уведомлений молчит, а не падает', () => {
    expect(() => {
      notifyOutcome(null, { kind: 'no-schema' });
    }).not.toThrow();
  });
});
