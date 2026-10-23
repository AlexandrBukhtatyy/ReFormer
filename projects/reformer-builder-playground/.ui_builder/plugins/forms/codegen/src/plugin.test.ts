/**
 * Плагин-хозяин генерации: состав вкладов, видимость панели, команды и генерация по заказу.
 *
 * Порт платформы и стек подставные — настоящие собирает композиция. Проверяется то, чем владеет
 * хозяин; вклады стека ReFormer — в тестах его плагина (`reformer/codegen`).
 *
 * @module plugins/forms/codegen/plugin.test
 */

import { describe, expect, it } from 'vitest';
import {
  CodegenStackPoint,
  type ModuleGeneratorService,
  type ResourceId,
  type WhenContext,
} from '@reformer/builder-plugin-api';
import { createFakePluginContext } from '../../../.shared/codegen-fakes';
import {
  codegenPanel,
  CODEGEN_PANEL_ID,
  CODEGEN_PLUGIN_ID,
  createCodegenPlugin,
  EJECT_TEMPLATE_COMMAND_ID,
  REFRESH_TARGETS_COMMAND_ID,
  GENERATE_COMMAND_ID,
} from './plugin';
import { GENERATE_INTO_COMMAND_ID } from './commands/generate-into';
import { createCodegenSessions } from './pipeline/state';
import { createFakeDocument, createFakeHost, createFakeStack, stacksOf } from './testing';
import type { CodegenHost } from './host';

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

/** Хозяин; стек-двойник, если нужен, вносит «соседний плагин». */
function activate(
  host: CodegenHost = createFakeHost(),
  stack?: ReturnType<typeof createFakeStack>
) {
  const fake = createFakePluginContext(CODEGEN_PLUGIN_ID);
  if (stack !== undefined) {
    const neighbour = createFakePluginContext('fake.stack', fake.contributions);
    neighbour.ctx.extensions.contribute(CodegenStackPoint, stack, { id: stack.id });
  }
  createCodegenPlugin({ host }).activate(fake.ctx);
  return fake;
}

describe('activate', () => {
  it('вносит панель, пункт документа и ничего от стека', () => {
    const { contributions } = activate();
    const own = contributions.filter((item) => item.pluginId === CODEGEN_PLUGIN_ID);
    expect(own.map((item) => [item.point, item.id])).toEqual([
      ['menu', 'codegen.context.generate'],
      ['panel', CODEGEN_PANEL_ID],
    ]);
  });

  it('регистрирует команды экспорта, целей проекта и генерации в каталог', () => {
    const { commands } = activate();
    // Список полный, а не «содержит»: команда, появившаяся незаметно, — это пункт палитры,
    // которого никто не заказывал, и сочетание клавиш, которое никто не назначал.
    expect(commands).toEqual([
      GENERATE_COMMAND_ID,
      REFRESH_TARGETS_COMMAND_ID,
      EJECT_TEMPLATE_COMMAND_ID,
      GENERATE_INTO_COMMAND_ID,
    ]);
  });

  it('везёт словарь сам — в своё пространство имён, а не в общее', () => {
    const { locales } = activate();
    expect(locales.sort()).toEqual(['en', 'ru']);
  });

  it('отдаёт наружу ровно генерацию по заказу', () => {
    const { services } = activate();
    expect([...services.keys()]).toEqual(['reformer.codegen.generator']);
  });
});

describe('возможность «сгенерировать код формы»', () => {
  it('прогон по заказу идёт через стек документа, отвечает отчётом и не сохраняет', async () => {
    const id = 'src/forms/loan/schema/form.schema.json';
    const host = createFakeHost({ document: createFakeDocument(id, '{}'), withSave: true });
    const stack = createFakeStack({ root: 'src/forms/loan', formName: 'loan' });
    const { services } = activate(host, stack);
    const generator = services.get('reformer.codegen.generator') as ModuleGeneratorService;

    const report = await generator.generate(id as ResourceId, { write: async () => null });

    expect(report).toMatchObject({ ok: true, dir: 'src/forms/loan', formName: 'loan' });
    expect(stack.printed).toHaveLength(1);
    expect(host.saved).toEqual([]);
  });

  it('отказ прогона называет ключ и текст словаря плагина', async () => {
    const { services } = activate();
    const generator = services.get('reformer.codegen.generator') as ModuleGeneratorService;
    const report = await generator.generate('nowhere' as ResourceId);
    expect(report).toEqual({ ok: false, error: 'error.no-document', message: 'error.no-document' });
  });
});

describe('видимость панели', () => {
  const panel = codegenPanel(
    createFakeHost(),
    createCodegenSessions(),
    stacksOf(createFakeStack({ kinds: ['form.schema', 'application/json'] })),
    () => [],
    'panel.right'
  );

  it('видна на документе, который печатает стек', () => {
    expect(panel.when?.(whenContext())).toBe(true);
    expect(panel.when?.(whenContext({ activeResourceKind: 'application/json' }))).toBe(true);
  });

  it('спрятана на прочих ресурсах и когда открытого документа нет', () => {
    expect(panel.when?.(whenContext({ activeResourceKind: 'text/typescript' }))).toBe(false);
    expect(panel.when?.(whenContext({ activeResourceKind: null }))).toBe(false);
  });

  it('без стеков не видна вовсе — печатать нечем', () => {
    const lonely = codegenPanel(
      createFakeHost(),
      createCodegenSessions(),
      stacksOf(),
      () => [],
      'panel.right'
    );
    expect(lonely.when?.(whenContext())).toBe(false);
  });

  it('панель вносится ОДИН раз, в названный слот', () => {
    expect(panel.slot).toBe('panel.right');
    expect(panel.id).toBe(CODEGEN_PANEL_ID);
  });
});
