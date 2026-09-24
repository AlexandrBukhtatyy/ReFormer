/**
 * Генерация в каталог: поиск схемы, отбор цели, адрес записи и исход.
 *
 * Порт подставной — тот же двойник, что у доставки и прогона. Проверяется то, чем владеет
 * плагин: где он ищет схему, что печатает, куда кладёт и что об этом говорит.
 *
 * @module plugins/codegen/commands/context-menu.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { NotificationsService, ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
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
import { wizardSchema } from '@reformer/builder-stack-reformer/testing';
import { BUILTIN_TARGETS } from '../pipeline/targets';
import { createFakeDocument, createFakeHost } from '../testing';
import { pluginMessageKey } from '@reformer/builder-plugin-api';
import { CODEGEN_PLUGIN_ID } from '../contract';

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
      file('form.schema.json'),
      file('types.ts'),
    ]).map((ref) => ref.name);

    // Канон, затем прежнее имя (форма, перегенерированная по новой раскладке, старый файл
    // не удаляет), затем по алфавиту.
    expect(names).toEqual([
      'form.schema.json',
      'renderer.schema.json',
      'alpha.form.json',
      'zebra.schema.json',
    ]);
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
      files: { [`${DIR}/form.schema.json`]: SCHEMA },
      document: createFakeDocument(`${DIR}/form.schema.json`, edited),
    });

    expect((await findSchemaIn(host, DIR))?.schema.root.component).toBe('$html(section)');
  });

  it('форма под прежним именем схемы тоже находится', async () => {
    const host = createFakeHost({ files: { [`${DIR}/renderer.schema.json`]: SCHEMA } });
    expect((await findSchemaIn(host, DIR))?.ref.name).toBe('renderer.schema.json');
  });

  it('без листинга искать негде', async () => {
    const host = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });
    delete host.list;

    expect(await findSchemaIn(host, DIR)).toBeNull();
  });
});

describe('генерация в каталог', () => {
  it('кладёт файлы В САМ каталог, а не в подпапку под ним', async () => {
    const host = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });

    const outcome = await generateInto({ host, targets }, { dir: DIR, targetId: 'codegen.types' });

    expect(outcome.kind).toBe('delivered');
    expect(host.written.has(`${DIR}/types.ts`)).toBe(true);
    expect([...host.written.keys()].some((id) => id.includes('/credit/credit'))).toBe(false);
  });

  it('одна цель печатается так же, как в составе всего модуля', async () => {
    const one = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });
    const all = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });

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

  it('для канонического имени схемы имя формы — имя каталога, а не «form»', async () => {
    const host = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });
    const outcome = await generateInto({ host, targets }, { dir: DIR, targetId: 'codegen.types' });
    expect(outcome).toMatchObject({ kind: 'delivered', formName: 'credit' });
    expect(host.written.get(`${DIR}/types.ts`)).toContain('CreditForm');
  });

  it('цель по шагам пишет ВСЕ свои экземпляры — по файлу на шаг', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/form.schema.json`]: JSON.stringify(wizardSchema()) },
    });
    const outcome = await generateInto(
      { host, targets },
      { dir: DIR, targetId: 'codegen.step-validation' }
    );
    expect(outcome.kind).toBe('delivered');
    if (outcome.kind !== 'delivered') return;
    expect(outcome.delivery.written.length).toBeGreaterThan(0);
    expect(
      outcome.delivery.written.every((p) => /^steps\/[^/]+\/form\.validation\.ts$/.test(p))
    ).toBe(true);
  });

  it('прежние имена и брошенные папки шагов доезжают до исхода', async () => {
    const host = createFakeHost({
      files: {
        [`${DIR}/renderer.schema.json`]: JSON.stringify(wizardSchema()),
        [`${DIR}/steps/pereimenovannyi/validation.ts`]: 'моё\n',
      },
    });
    const outcome = await generateInto({ host, targets }, { dir: DIR });
    if (outcome.kind !== 'delivered') throw new Error(outcome.kind);
    expect(outcome.delivery.legacy).toContainEqual({
      path: 'renderer.schema.json',
      replacedBy: 'form.schema.json',
      carried: false,
    });
    expect(outcome.delivery.orphans).toEqual(['steps/pereimenovannyi']);
    expect(host.written.get(`${DIR}/steps/pereimenovannyi/validation.ts`)).toBe('моё\n');
  });

  it('цель, не применившаяся к форме, названа, а не пропущена молча', async () => {
    const host = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });

    // Шим визарда печатается только у формы с узлом-визардом; здесь его нет.
    const outcome = await generateInto({ host, targets }, { dir: DIR, targetId: 'codegen.wizard' });

    expect(outcome).toEqual({ kind: 'not-applicable', targetId: 'codegen.wizard' });
  });

  it('отказы названы: нет каталога, нет схемы, нет кита, источник только для чтения', async () => {
    const empty = createFakeHost();
    expect((await generateInto({ host: empty, targets }, {})).kind).toBe('no-directory');
    expect((await generateInto({ host: empty, targets }, { dir: DIR })).kind).toBe('no-schema');

    const noKit = createFakeHost({
      files: { [`${DIR}/form.schema.json`]: SCHEMA },
      kit: null,
    });
    expect((await generateInto({ host: noKit, targets }, { dir: DIR })).kind).toBe('no-kit');

    const readOnly = createFakeHost({
      files: { [`${DIR}/form.schema.json`]: SCHEMA },
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
          delivery: {
            dir: DIR,
            written: [],
            skipped: [],
            failed: [],
            saved: null,
            orphans: [],
            legacy: [],
          },
        },
        'info',
      ],
      [
        {
          kind: 'delivered',
          formName: 'credit',
          delivery: {
            dir: DIR,
            written: ['types.ts'],
            skipped: [],
            failed: [],
            saved: true,
            orphans: [],
            legacy: [],
          },
        },
        'success',
      ],
    ];

    for (const [outcome, level] of cases) {
      const { calls, notifications } = sink();
      notifyOutcome(notifications, outcome);
      expect(calls).toEqual([
        { level, key: expect.stringContaining(pluginMessageKey(CODEGEN_PLUGIN_ID, 'notify.')) },
      ]);
    }
  });

  it('прежние имена и сироты — отдельные предупреждения; у схемы — действие «открыть»', () => {
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
        delivery: {
          dir: DIR,
          written: ['form.schema.json'],
          skipped: [],
          failed: [],
          saved: null,
          orphans: ['steps/old'],
          legacy: [
            { path: 'renderer.schema.json', replacedBy: 'form.schema.json', carried: false },
          ],
        },
      },
      {
        resolve: (dir, ...segments) => [dir, ...segments].join('/') as ResourceId,
        openResource: (id) => opened.push(id),
      }
    );
    const key = (k: string) => pluginMessageKey(CODEGEN_PLUGIN_ID, k);
    expect(shown.map((n) => n.key)).toEqual([
      key('notify.legacy'),
      key('notify.orphans'),
      key('notify.written'),
    ]);
    shown[0]?.action?.run();
    expect(opened).toEqual([`${DIR}/form.schema.json`]);
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
