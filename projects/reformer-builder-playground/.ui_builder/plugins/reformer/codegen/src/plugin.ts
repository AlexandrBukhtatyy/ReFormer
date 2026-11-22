/**
 * Стек ReFormer в генерации кода — плагин `reformer.codegen-schema`: вклады в точки хозяина
 * генерации и то, что знает только стек.
 *
 * Хозяин генерации — `reformer.codegen` в домене платформы форм (панель «Экспорт формы», запись
 * модуля, цели из проекта, генерация по заказу ассистента) — общий для любого формата формы.
 * Стек ReFormer вносит:
 *
 * - **себя** — в `CodegenStackPoint`: форма документа, место модуля, печать, модуль на диске;
 * - **свои цели** — в `CodegenTargetPoint`: файлы модуля ReFormer. Вносятся в активации и уходят
 *   вместе со стеком, поэтому «выключить стек» — это действительно выключить его цели, а не
 *   оставить полсписка;
 * - **печать по заказу** — возможность `reformer.codegen.printer` для шаблонов форм;
 * - **фикстуру предпросмотра** — команду `codegen.create-fixture`: фикстура — артефакт превью, а
 *   не файл модуля, и пишется по явной просьбе, а не при каждой регенерации;
 * - **подраздел «ReFormer»** подменю «Сгенерировать» в дереве — его подписи в словаре стека.
 *
 * @module plugins/reformer/codegen/plugin
 */

import {
  CodegenStackPoint,
  CodegenTargetPoint,
  definePlugin,
  MenuPoint,
  type CodegenTarget,
  type CommandContribution,
  type Plugin,
  type PluginContext,
  type ResourceId,
  type WhenContext,
} from '@reformer/builder-plugin-api';
import { applyOverrides, targetsOfStack } from '@reformer/builder-toolkit';
import { createFixture, type FixtureOutcome } from './commands/fixture-command';
import { codegenContextMenuItems } from './commands/menu';
import { CODEGEN_STACK_MESSAGES } from './messages';
import { ModulePrinterCapability, modulePrinter } from './printer';
import { CODEGEN_STACK_KINDS, createCodegenStack } from './stack/stack';
import { BUILTIN_TARGETS, CODEGEN_STACK_ID, staleOverride } from './pipeline/targets';
import { codegenStackWorkspace, type CodegenStackWorkspace } from './workspace';
import manifest from './manifest.json';

/** Идентификатор команды создания фикстуры предпросмотра. */
export const CREATE_FIXTURE_COMMAND_ID = 'codegen.create-fixture';

/** Документ ли стека активен — по виду ресурса, как у панели хозяина. */
export function stackDocumentActive(ctx: WhenContext): boolean {
  return ctx.activeResourceKind !== null && CODEGEN_STACK_KINDS.includes(ctx.activeResourceKind);
}

/**
 * Адрес документа из аргументов команды.
 *
 * Проверяется, а не приводится типом: аргументы приходят от кого угодно — из меню, из палитры,
 * от ассистента, — и `as { documentId: string }` здесь означал бы доверие к чужой строке.
 */
function documentIdOf(args: unknown): ResourceId | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as { documentId?: unknown }).documentId;
  return typeof value === 'string' ? value : null;
}

/** Показывает исход создания фикстуры. Открывает файл, только когда он действительно записан. */
function notifyFixture(workspace: CodegenStackWorkspace, outcome: FixtureOutcome): void {
  if (outcome.kind === 'written') {
    workspace.openResource(outcome.id);
    return;
  }
  // Остальные исходы объясняет панель: у команды нет своего места для сообщения, а заводить
  // его ради трёх строк значило бы вторую систему уведомлений рядом с существующей.
  console.info('[codegen] фикстура не создана:', outcome.kind);
}

/**
 * Команда «Создать фикстуру предпросмотра» — по документу из аргументов либо по активному.
 *
 * Активный документ стек узнаёт сам, у своей рабочей области: состояния панели у него нет.
 */
export function fixtureCommand(workspace: CodegenStackWorkspace): CommandContribution {
  return {
    id: CREATE_FIXTURE_COMMAND_ID,
    titleKey: 'command.create-fixture',
    enabled: stackDocumentActive,
    run(args) {
      const documentId = documentIdOf(args) ?? workspace.activeResource();
      if (documentId === null) return;
      void createFixture(workspace, documentId).then((outcome) => {
        // Исход показывается всегда, включая «ничего не сделал»: человек нажал кнопку и обязан
        // узнать, что произошло, — молчание тут читается как поломка.
        notifyFixture(workspace, outcome);
      });
    },
  };
}

export interface CodegenStackActivation {
  /** Рабочая область целиком — только для теста, зовущего стек без реестра служб. */
  readonly workspace?: CodegenStackWorkspace;
}

/**
 * Внести стек в контекст активации: словарь, стек, цели, печать, фикстура, меню дерева.
 *
 * Всё уходит подписками контекста — вместе с плагином, который стек активировал.
 */
export function activateCodegenStack(
  ctx: PluginContext,
  options: CodegenStackActivation = {}
): void {
  for (const [locale, messages] of Object.entries(CODEGEN_STACK_MESSAGES)) {
    ctx.i18n.contribute(locale, messages);
  }
  const workspace = options.workspace ?? codegenStackWorkspace(ctx);

  const stack = createCodegenStack({
    kit: workspace.kit,
    catalog: workspace.catalog,
    translate: (key, params) => ctx.i18n.t(key, params as Record<string, unknown> | undefined),
  });
  ctx.subscriptions.push(ctx.extensions.contribute(CodegenStackPoint, stack, { id: stack.id }));

  for (const target of BUILTIN_TARGETS) {
    ctx.subscriptions.push(
      ctx.extensions.contribute(CodegenTargetPoint, target, { id: target.id, order: target.order })
    );
  }

  ctx.subscriptions.push(ctx.services.register(ModulePrinterCapability, modulePrinter(workspace)));

  ctx.subscriptions.push(ctx.commands.register(fixtureCommand(workspace)));

  // Цели стека в меню — те же, что печатаются: общее правило замен из toolkit, со своим
  // крючком устаревания, по полному списку вкладов (свои, чужие, из проекта).
  const targets = (): readonly CodegenTarget[] =>
    applyOverrides(
      targetsOfStack(
        ctx.extensions.get(CodegenTargetPoint).map((contribution) => contribution.value),
        CODEGEN_STACK_ID
      ),
      staleOverride
    );
  for (const item of codegenContextMenuItems(targets)) {
    ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
  }
}

/** Идентификатор плагина стека: пространство имён его словаря и вкладов. */
export const CODEGEN_STACK_PLUGIN_ID = manifest.id;

/** Собирает плагин стека ReFormer в генерации кода. */
export function createCodegenStackPlugin(options: CodegenStackActivation = {}): Plugin {
  return definePlugin({
    id: CODEGEN_STACK_PLUGIN_ID,
    activate(ctx) {
      activateCodegenStack(ctx, options);
    },
  });
}
