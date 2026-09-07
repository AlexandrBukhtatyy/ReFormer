/**
 * Плагин: состав вкладов, видимость панели и команда.
 *
 * Порт платформы подставной — настоящий собирается композицией и требует рабочей области.
 * Проверяется то, чем владеет плагин.
 *
 * @module plugins/codegen/plugin.test
 */

import { describe, expect, it } from 'vitest';
import type { PluginContext, WhenContext } from '@/sdk';
import {
  codegenPanel,
  CODEGEN_PANEL_ID,
  CODEGEN_PLUGIN_ID,
  createCodegenPlugin,
  CREATE_FIXTURE_COMMAND_ID,
  EJECT_TEMPLATE_COMMAND_ID,
  REFRESH_TARGETS_COMMAND_ID,
  GENERATE_COMMAND_ID,
  panelVisible,
} from './plugin';
import { GENERATE_INTO_COMMAND_ID } from './commands/context-menu';
import { BUILTIN_TARGETS } from './pipeline/targets';
import { createCodegenSessions } from './pipeline/state';
import { createFakeHost } from './testing';

function whenContext(patch: Partial<WhenContext> = {}): WhenContext {
  return {
    focus: 'canvas',
    activeEditorId: 'fake:form.json',
    activeResourceKind: 'form.schema',
    hasSelection: false,
    previewMode: null,
    ...patch,
  };
}

/** Реестры в объёме, который трогает `activate`. */
function fakeContext() {
  const contributed: { point: string; id?: string; order?: number }[] = [];
  const commands: string[] = [];
  const ctx = {
    id: CODEGEN_PLUGIN_ID,
    subscriptions: [],
    extensions: {
      contribute: (
        point: { id: string },
        _value: unknown,
        meta?: { id?: string; order?: number }
      ) => {
        contributed.push({ point: point.id, id: meta?.id, order: meta?.order });
        return { dispose: () => undefined };
      },
      get: () => [],
      observe: () => ({ dispose: () => undefined }),
    },
    commands: {
      register: (command: { id: string }) => {
        commands.push(command.id);
        return { dispose: () => undefined };
      },
      execute: () => Promise.resolve(true),
    },
    // Служб нет ни одной, и это НЕ упущение двойника: композиция вправе не дать уведомлений,
    // и плагин обязан активироваться без них — молча, а не отказом.
    services: { get: () => undefined },
  } as unknown as PluginContext;
  return { ctx, contributed, commands };
}

describe('activate', () => {
  it('вносит все встроенные цели вкладами, а не держит их массивом', () => {
    const { ctx, contributed } = fakeContext();
    createCodegenPlugin({ host: createFakeHost() }).activate(ctx);
    const targets = contributed.filter((item) => item.point === 'codegen.target');
    expect(targets.map((item) => item.id)).toEqual(BUILTIN_TARGETS.map((t) => t.id));
  });

  it('порядок целей задаётся вкладом, а не позицией в массиве', () => {
    const { ctx, contributed } = fakeContext();
    createCodegenPlugin({ host: createFakeHost() }).activate(ctx);
    const orders = contributed
      .filter((item) => item.point === 'codegen.target')
      .map((item) => item.order);
    expect(orders).toEqual(BUILTIN_TARGETS.map((t) => t.order));
    // Шаг кратен десяти: между любыми двумя нашими целями помещается чужая.
    expect(orders.every((order) => order !== undefined && order % 10 === 0)).toBe(true);
  });

  it('вносит панель', () => {
    const { ctx, contributed } = fakeContext();
    createCodegenPlugin({ host: createFakeHost() }).activate(ctx);
    expect(contributed.at(-1)).toMatchObject({ point: 'panel', id: CODEGEN_PANEL_ID });
  });

  it('вклад уходит в ТУ точку, которую дала композиция', () => {
    const { ctx, contributed } = fakeContext();
    createCodegenPlugin({
      host: createFakeHost(),
      targetPoint: { id: 'codegen.target.v2' },
    }).activate(ctx);
    expect(contributed.filter((item) => item.point === 'codegen.target.v2')).toHaveLength(
      BUILTIN_TARGETS.length
    );
  });

  it('регистрирует команды экспорта, фикстуры, целей проекта и генерации в каталог', () => {
    const { ctx, commands } = fakeContext();
    createCodegenPlugin({ host: createFakeHost() }).activate(ctx);
    // Список полный, а не «содержит»: команда, появившаяся незаметно, — это пункт палитры,
    // которого никто не заказывал, и сочетание клавиш, которое никто не назначал.
    expect(commands).toEqual([
      GENERATE_COMMAND_ID,
      CREATE_FIXTURE_COMMAND_ID,
      REFRESH_TARGETS_COMMAND_ID,
      EJECT_TEMPLATE_COMMAND_ID,
      GENERATE_INTO_COMMAND_ID,
    ]);
  });

  it('вносит и пункт документа, и подменю каталога — это разные вопросы', () => {
    const { ctx, contributed } = fakeContext();
    createCodegenPlugin({ host: createFakeHost() }).activate(ctx);
    const menu = contributed.filter((item) => item.point === 'menu').map((item) => item.id);
    expect(menu).toEqual([
      'codegen.context.generate',
      'codegen.context.submenu',
      'codegen.context.all',
      'codegen.context.targets',
    ]);
  });

  it('везёт словарь сам, если есть куда его положить', () => {
    const { ctx } = fakeContext();
    const locales: string[] = [];
    createCodegenPlugin({
      host: createFakeHost(),
      i18n: { contribute: (locale) => locales.push(locale) },
    }).activate(ctx);
    expect(locales.sort()).toEqual(['en', 'ru']);
  });
});

describe('видимость панели', () => {
  it('видна на модельном документе схемы', () => {
    expect(panelVisible(whenContext())).toBe(true);
    expect(panelVisible(whenContext({ activeResourceKind: 'application/json' }))).toBe(true);
  });

  it('спрятана на прочих ресурсах и когда открытого документа нет', () => {
    expect(panelVisible(whenContext({ activeResourceKind: 'text/typescript' }))).toBe(false);
    expect(panelVisible(whenContext({ activeResourceKind: null }))).toBe(false);
  });

  it('панель вносится ОДИН раз, а видимостью управляет предикат', () => {
    const panel = codegenPanel(createFakeHost(), createCodegenSessions(), () => [], 'panel.right');
    expect(panel.when).toBe(panelVisible);
    expect(panel.slot).toBe('panel.right');
  });
});
