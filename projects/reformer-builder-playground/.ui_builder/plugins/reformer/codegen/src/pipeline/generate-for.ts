/**
 * Генерация по заказу другого плагина: тот же прогон, что у панели, но запись — дверью заказчика.
 *
 * Заведено ради ассистента: «сгенерируй код формы» — законная просьба к нему, а запись модуля
 * обязана стать частью хода — с пометкой ассистента и отменой вместе с правками формы. Поэтому
 * писать прогон должен не в рабочую копию напрямую, а тем, что даст заказчик.
 *
 * ## Чем отличается от панели
 *
 * - **Запись** — функцией заказчика. Её отказ — не сбой: файл остаётся как был и попадает в
 *   отчёт пропущенным с причиной. Так ассистент не трогает документ формы, который правит сам.
 * - **Сохранения нет.** Записанное остаётся несохранённой рабочей копией: сохранить — решение
 *   человека, и право `workspace.save` у плагина — ради его кнопки, а не ради чужого хода.
 * - **Отчёт — значением.** Панель смотрит в состояние, а заказчику нужен ответ на вызов; состояние
 *   при этом обновляется тем же прогоном — открытая панель экспорта показывает и этот прогон.
 *
 * @module plugins/reformer/codegen/pipeline/generate-for
 */

import { moduleRootPathOf } from '../../../core/codegen';
import type {
  GenerateReport,
  GenerateRequest,
  GenerateSkipReason,
  ResourceId,
} from '@reformer/builder-plugin-api';
import type { CodegenTarget } from '../contract';
import type { CodegenHost } from '../host';
import type { CodegenProblem } from './generate';
import { runCodegen } from './run';
import type { CodegenStore } from './state';

// Заказ, отчёт и дверь записи — контракт возможности генерации в SDK: его берёт заказчик.
export type {
  GenerateReport,
  GenerateRequest,
  GenerateSkipReason,
  GenerateWrite,
} from '@reformer/builder-plugin-api';

/** Отказ записи заказчика — исключением, чтобы доставка учла файл и пошла дальше. */
class RefusedWrite extends Error {}

export interface GenerateForOptions {
  readonly host: CodegenHost;
  readonly targets: readonly CodegenTarget[];
  readonly store: CodegenStore;
  readonly problems?: readonly CodegenProblem[];
  /** Текст отказа по ключу словаря кодогена. */
  readonly translate: (key: string, params?: Readonly<Record<string, string>>) => string;
}

/** Напечатать и записать модуль формы `documentId` дверью заказчика. Ничего не бросает. */
export async function generateFor(
  options: GenerateForOptions,
  documentId: ResourceId,
  request: GenerateRequest = {}
): Promise<GenerateReport> {
  const { host, store, translate } = options;
  const refused = new Map<ResourceId, string>();
  const write = request.write;
  // Сохранения нет у заказа в любом случае: записанное — рабочая копия (см. шапку модуля).
  const scoped: CodegenHost = {
    ...host,
    save: undefined,
    writeText: async (id, text) => {
      if (write === undefined) return host.writeText(id, text);
      const reason = await write(id, text);
      if (reason === null) return;
      refused.set(id, reason);
      throw new RefusedWrite(reason);
    },
  };

  try {
    await runCodegen({
      host: scoped,
      targets: options.targets,
      documentId,
      store,
      formName: request.formName ?? store.get().formName,
      problems: options.problems,
    });
  } catch (error) {
    // Непредвиденное: прогон положил в состояние `error.failed`, заказчику — текст поломки.
    return {
      ok: false,
      error: 'error.failed',
      message: `${translate('error.failed')} ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const state = store.get();
  // Путь документа читается ПОСЛЕ прогона: документ закрыли — прогон уже сказал об этом отказом.
  const document = host.documentOf(documentId);
  if (state.errorKey !== null || state.delivery === null || document === null) {
    const key = state.errorKey ?? 'error.failed';
    const detail = state.errorDetail === undefined ? '' : ` ${state.errorDetail}`;
    return { ok: false, error: key, message: `${translate(key, state.errorParams)}${detail}` };
  }

  const { delivery } = state;
  const skipped: { path: string; reason: GenerateSkipReason; message?: string }[] =
    delivery.skipped.map((file) => ({ ...file }));
  const failed: { path: string; message: string }[] = [];
  for (const file of delivery.failed) {
    const reason = refused.get(host.resolve(delivery.dir, ...file.path.split('/')));
    if (reason === undefined) failed.push(file);
    else skipped.push({ path: file.path, reason: 'refused', message: reason });
  }
  return {
    ok: true,
    formName: state.formName,
    dir: moduleRootPathOf(document.ref.path),
    written: delivery.written,
    skipped,
    failed,
  };
}
