/**
 * Внести стек ReFormer в шаблоны форм: сам стек — в `TemplateStackPoint`, встроенные шаблоны —
 * хранилищем в `TemplateStorePoint`.
 *
 * Встроенное хранилище идёт первым (порядок 10): группы панели следуют порядку вкладов, и
 * неизменяемое стоит раньше проектного и личного. Хранилища хозяина — проект и браузер — от стека
 * не зависят и вносятся хозяином.
 *
 * @module plugins/reformer/templates/stack/activate
 */

import {
  TemplateStackPoint,
  TemplateStorePoint,
  type PluginContext,
} from '@reformer/builder-plugin-api';
import type { KitView } from '../../../core/codegen';
import { createBuiltinStore, type ModulePrinter } from './builtin';
import { createTemplateStack } from './stack';
import { hasPrinter, templateStackKit, templatesPrinter } from './workspace';

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
