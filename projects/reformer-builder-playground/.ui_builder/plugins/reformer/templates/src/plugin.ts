/**
 * Стек ReFormer в шаблонах форм — плагин `reformer.templates-schema`: вклады в точки хозяина
 * шаблонов и то, что знает только стек.
 *
 * Хозяин шаблонов — `reformer.templates` в домене платформы форм (панель «Шаблоны», хранилища
 * проекта и браузера, снимок каталога, подстановка имени, запись новой формы, создание по заказу
 * ассистента) — общий для любого формата формы. Стек ReFormer вносит:
 *
 * - **себя** — в `TemplateStackPoint`: документ формы и сборка шагов, перевод в формат 2, вид
 *   генерации для шаблона на движке, токены имён модуля, пустая форма, место модуля и фикстуры;
 * - **встроенные шаблоны** — хранилищем в `TemplateStorePoint`, первым (порядок 10): группы панели
 *   следуют порядку вкладов, и неизменяемое стоит раньше проектного и личного. Затравки печатает
 *   генерация кода — возможностью `reformer.codegen.printer`.
 *
 * Всё уходит подписками контекста: «выключить стек» — это убрать и его ответы, и его шаблоны.
 *
 * @module plugins/reformer/templates/plugin
 */

import {
  definePlugin,
  TemplateStackPoint,
  TemplateStorePoint,
  type Plugin,
  type PluginContext,
} from '@reformer/builder-plugin-api';
import type { KitView } from '../../core/codegen';
import { createBuiltinStore, type ModulePrinter } from './builtin';
import { createTemplateStack } from './stack';
import { hasPrinter, templateStackKit, templatesPrinter } from './workspace';
import manifest from './manifest.json';

/** Идентификатор вклада встроенного хранилища. */
export const BUILTIN_STORE_ID = 'templates.store.builtin';

export interface TemplateStackActivation {
  /**
   * Печатник модуля формы для встроенных шаблонов — только для теста.
   *
   * В приложении он берётся возможностью `reformer.codegen.printer` у стека генерации, в момент
   * печати: плагины друг друга не импортируют, а оба ленивые, и порядок активации незначим.
   */
  readonly print?: ModulePrinter;
  /** Кит целиком — только для теста, зовущего стек без реестра служб. */
  readonly kit?: KitView | null;
}

/** Вносит стек и встроенное хранилище; всё уходит подписками контекста. */
export function activateTemplateStack(
  ctx: PluginContext,
  options: TemplateStackActivation = {}
): void {
  const given = options.kit;
  const view = given === undefined ? templateStackKit(ctx) : () => given;

  const stack = createTemplateStack({ kit: view });
  ctx.subscriptions.push(ctx.extensions.contribute(TemplateStackPoint, stack, { id: stack.id }));

  // Печатник спрашивается у возможности на каждый вызов, а «есть ли он» — отдельным вопросом:
  // оба плагина ленивые, и генерация кода вправе подняться позже шаблонов. Кит — тоже на каждую
  // печать: затравка кладёт только то, что есть в его каталоге, а кит переключают.
  const builtin = createBuiltinStore({
    print: options.print ?? templatesPrinter(ctx),
    ...(options.print === undefined ? { ready: () => hasPrinter(ctx) } : {}),
    catalog: () => view()?.catalog ?? [],
    kit: () => view()?.kit ?? null,
  });
  ctx.subscriptions.push(
    ctx.extensions.contribute(TemplateStorePoint, builtin, { id: BUILTIN_STORE_ID, order: 10 })
  );
}

/** Идентификатор плагина стека: пространство имён его вкладов. */
export const TEMPLATE_STACK_PLUGIN_ID = manifest.id;

/** Собирает плагин стека ReFormer в шаблонах форм. */
export function createTemplateStackPlugin(options: TemplateStackActivation = {}): Plugin {
  return definePlugin({
    id: TEMPLATE_STACK_PLUGIN_ID,
    activate(ctx) {
      activateTemplateStack(ctx, options);
    },
  });
}
