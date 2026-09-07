/**
 * Генерация в каталог: поиск схемы, отбор цели, адрес записи и исход.
 *
 * Порт подставной — тот же двойник, что у доставки и прогона. Проверяется то, чем владеет
 * плагин: где он ищет схему, что печатает, куда кладёт и что об этом говорит.
 *
 * @module plugins/codegen/commands/context-menu.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { NotificationsService, ResourceId, ResourceRef } from '@/sdk';
import {
  codegenContextMenuItems,
  findSchemaIn,
  generateInto,
  generateIntoArgs,
  notifyOutcome,
  schemaCandidates,
  CODEGEN_CONTEXT_SUBMENU,
  GENERATE_INTO_COMMAND_ID,
  type GenerateIntoOutcome,
} from './context-menu';
import { BUILTIN_TARGETS } from '../pipeline/targets';
import { createFakeDocument, createFakeHost } from '../testing';

/** Минимальная схема, которую `isFormSchema` признаёт формой. */
const SCHEMA = JSON.stringify({
  version: '1.0',
  root: {
    component: '$html(div)',
    children: [{ selector: 'name', value: '$model(name)', component: '$component(Input)' }],
  },
});

const DIR = 'fake:forms/credit' as ResourceId;

function file(name: string): ResourceRef {
  return {
    id: `${DIR}/${name}` as ResourceId,
    sourceId: 'fake',
    path: `forms/credit/${name}`,
    name,
    kind: 'file',
    mediaType: 'application/json',
  };
}

const targets = () => BUILTIN_TARGETS;

describe('поиск схемы в каталоге', () => {
  it('канон идёт первым, остальные — по алфавиту', () => {
    const names = schemaCandidates([
      file('zebra.schema.json'),
      file('renderer.schema.json'),
      file('alpha.form.json'),
      file('types.ts'),
    ]).map((ref) => ref.name);

    expect(names).toEqual(['renderer.schema.json', 'alpha.form.json', 'zebra.schema.json']);
  });

  it('файлы, не похожие на схему, не читаются вовсе', async () => {
    const host = createFakeHost({ files: { [`${DIR}/model.ts`]: 'export const x = 1;' } });
    const readText = vi.spyOn(host, 'readText');

    expect(await findSchemaIn(host, DIR)).toBeNull();
    expect(readText).not.toHaveBeenCalled();
  });

  it('неразбираемый кандидат не прекращает поиск', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/broken.form.json`]: '{ не json', [`${DIR}/ok.schema.json`]: SCHEMA },
    });

    expect((await findSchemaIn(host, DIR))?.ref.name).toBe('ok.schema.json');
  });

  it('открытый документ важнее файла на диске: в нём текст, который человек видит', async () => {
    const edited = JSON.stringify({
      version: '1.0',
      root: { component: '$html(section)', children: [] },
    });
    const host = createFakeHost({
      files: { [`${DIR}/renderer.schema.json`]: SCHEMA },
      document: createFakeDocument(`${DIR}/renderer.schema.json`, edited),
    });

    expect((await findSchemaIn(host, DIR))?.schema.root.component).toBe('$html(section)');
  });

  it('без листинга искать негде', async () => {
    const host = createFakeHost({ files: { [`${DIR}/renderer.schema.json`]: SCHEMA } });
    delete host.list;

    expect(await findSchemaIn(host, DIR)).toBeNull();
  });
});

describe('генерация в каталог', () => {
  it('кладёт файлы В САМ каталог, а не в подпапку под ним', async () => {
    const host = createFakeHost({ files: { [`${DIR}/renderer.schema.json`]: SCHEMA } });

    const outcome = await generateInto({ host, targets }, { dir: DIR, targetId: 'codegen.types' });

    expect(outcome.kind).toBe('delivered');
    expect(host.written.has(`${DIR}/types.ts`)).toBe(true);
    expect([...host.written.keys()].some((id) => id.includes('/credit/credit'))).toBe(false);
  });

  it('одна цель печатается так же, как в составе всего модуля', async () => {
    const one = createFakeHost({ files: { [`${DIR}/renderer.schema.json`]: SCHEMA } });
    const all = createFakeHost({ files: { [`${DIR}/renderer.schema.json`]: SCHEMA } });

    await generateInto({ host: one, targets }, { dir: DIR, targetId: 'codegen.registry' });
    await generateInto({ host: all, targets }, { dir: DIR });

    expect(one.written.get(`${DIR}/registry.ts`)).toBe(all.written.get(`${DIR}/registry.ts`));
    // И записан ровно один файл: остальные цели печатались только ради контекста.
    expect([...one.written.keys()].filter((id) => !id.endsWith('.schema.json'))).toEqual([
      `${DIR}/registry.ts`,
    ]);
  });

  it('имя формы берётся из аргумента, а без него — из имени файла схемы', async () => {
    const named = createFakeHost({ files: { [`${DIR}/credit.schema.json`]: SCHEMA } });
    await generateInto(
      { host: named, targets },
      { dir: DIR, targetId: 'codegen.types', formName: 'credit-application' }
    );
    expect(named.written.get(`${DIR}/types.ts`)).toContain('CreditApplicationForm');

    const fallback = createFakeHost({ files: { [`${DIR}/credit.schema.json`]: SCHEMA } });
    await generateInto({ host: fallback, targets }, { dir: DIR, targetId: 'codegen.types' });
    expect(fallback.written.get(`${DIR}/types.ts`)).toContain('CreditForm');
  });

  it('цель, не применившаяся к форме, названа, а не пропущена молча', async () => {
    const host = createFakeHost({ files: { [`${DIR}/renderer.schema.json`]: SCHEMA } });

    // Шим визарда печатается только у формы с узлом-визардом; здесь его нет.
    const outcome = await generateInto({ host, targets }, { dir: DIR, targetId: 'codegen.wizard' });

    expect(outcome).toEqual({ kind: 'not-applicable', targetId: 'codegen.wizard' });
  });

  it('отказы названы: нет каталога, нет схемы, нет кита, источник только для чтения', async () => {
    const empty = createFakeHost();
    expect((await generateInto({ host: empty, targets }, {})).kind).toBe('no-directory');
    expect((await generateInto({ host: empty, targets }, { dir: DIR })).kind).toBe('no-schema');

    const noKit = createFakeHost({
      files: { [`${DIR}/renderer.schema.json`]: SCHEMA },
      kit: null,
    });
    expect((await generateInto({ host: noKit, targets }, { dir: DIR })).kind).toBe('no-kit');

    const readOnly = createFakeHost({
      files: { [`${DIR}/renderer.schema.json`]: SCHEMA },
      write: false,
    });
    expect((await generateInto({ host: readOnly, targets }, { dir: DIR })).kind).toBe('read-only');
  });

  it('аргументы проверяются по полю, а не приводятся целиком', () => {
    expect(generateIntoArgs({ dir: DIR, targetId: 'codegen.types' })).toEqual({
      dir: DIR,
      targetId: 'codegen.types',
      formName: undefined,
    });
    expect(generateIntoArgs({ dir: 42, targetId: null })).toEqual({
      dir: undefined,
      targetId: undefined,
      formName: undefined,
    });
    expect(generateIntoArgs('не объект')).toEqual({
      dir: undefined,
      targetId: undefined,
      formName: undefined,
    });
  });
});

describe('исход говорится словами', () => {
  function sink() {
    const calls: { level: string; key: string }[] = [];
    const record =
      (level: string) =>
      (key: string): never =>
        calls.push({ level, key }) as never;
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

  it('о каждом исходе, включая «ничего не записал»', () => {
    const cases: readonly [GenerateIntoOutcome, string][] = [
      [{ kind: 'no-schema' }, 'warning'],
      [{ kind: 'no-kit' }, 'error'],
      [{ kind: 'not-applicable', targetId: 'codegen.wizard' }, 'info'],
      [
        {
          kind: 'delivered',
          formName: 'credit',
          delivery: { dir: DIR, written: [], skipped: [], failed: [], saved: null },
        },
        'info',
      ],
      [
        {
          kind: 'delivered',
          formName: 'credit',
          delivery: { dir: DIR, written: ['types.ts'], skipped: [], failed: [], saved: true },
        },
        'success',
      ],
    ];

    for (const [outcome, level] of cases) {
      const { calls, notifications } = sink();
      notifyOutcome(notifications, outcome);
      expect(calls).toEqual([{ level, key: expect.stringContaining('codegen.notify.') }]);
    }
  });

  it('без сервиса уведомлений молчит, а не падает', () => {
    expect(() => {
      notifyOutcome(null, { kind: 'no-schema' });
    }).not.toThrow();
  });
});

describe('вклады подменю', () => {
  const items = codegenContextMenuItems(targets);

  it('заголовок гаснет на файле и доступен на каталоге', () => {
    const submenu = items[0].value;
    if (submenu.kind !== 'submenu') throw new Error('первым вкладом обязан быть заголовок');
    const ctx = {} as never;

    const at = (ref: { kind: string } | null): boolean =>
      submenu.enabledWhen?.(ctx, { ref, dir: DIR, selection: [], rootId: DIR }) ?? true;

    expect(at({ kind: 'directory' })).toBe(true);
    expect(at(null)).toBe(true);
    expect(at({ kind: 'file' })).toBe(false);
  });

  it('цели приходят динамической группой: их состав известен только в рантайме', () => {
    const dynamic = items[2].value;
    if (dynamic.kind !== 'dynamic') throw new Error('цели обязаны быть динамической группой');

    const built = dynamic.items({} as never, {
      ref: { id: DIR, name: 'credit', kind: 'directory' },
      dir: DIR,
      selection: [],
      rootId: DIR,
    });

    expect(built).toHaveLength(BUILTIN_TARGETS.length);
    expect(built[0]).toMatchObject({
      command: GENERATE_INTO_COMMAND_ID,
      titleKey: 'target.schema',
      args: { dir: DIR, targetId: 'codegen.schema', formName: 'credit' },
    });
  });

  it('чужая цель без ключа подписывается именем файла', () => {
    const foreign = codegenContextMenuItems(() => [
      { id: 'foreign.one', path: 'foreign.ts', cls: 'user', emit: () => '' },
    ])[2].value;
    if (foreign.kind !== 'dynamic') throw new Error('цели обязаны быть динамической группой');

    expect(foreign.items({} as never, { ref: null, dir: DIR, selection: [], rootId: DIR })).toEqual(
      [expect.objectContaining({ title: 'foreign.ts', titleKey: undefined })]
    );
  });

  it('пункты вносятся в подменю, а не в корень контекстного меню', () => {
    expect(items[1].value).toMatchObject({ menu: CODEGEN_CONTEXT_SUBMENU });
    expect(items[2].value).toMatchObject({ menu: CODEGEN_CONTEXT_SUBMENU });
  });
});
