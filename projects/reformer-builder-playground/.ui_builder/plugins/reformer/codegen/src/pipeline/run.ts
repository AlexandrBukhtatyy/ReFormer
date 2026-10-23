/**
 * Один прогон генерации: документ → стек → файлы → рабочая область → отчёт.
 *
 * Отдельно от панели и от команды, потому что запускают обе, а результат обязан быть один
 * и тот же. Отдельно от стека и доставки, потому что те не знают ни состояния, ни отчёта: здесь
 * выбирается стек документа, собираются его цели и разбираются отказы.
 *
 * ## Отказы названы, а не брошены
 *
 * Все — законные состояния, а не ошибки программы: документ закрыли, его не печатает ни один стек,
 * стек отказал (форма не собирается, кита нет), источник не принимает запись. Каждый превращается
 * в ключ словаря — хозяина либо стека — и показывается в панели. Исключением наружу уходит
 * только то, чего мы не предвидели.
 *
 * @module plugins/reformer/codegen/pipeline/run
 */

import {
  isCodegenRefusal,
  type CodegenProblem,
  type CodegenRefusal,
  type CodegenTarget,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { deliverInto, DeliveryRefusedError, SourceReadOnlyError } from './deliver';
import type { CodegenHost } from '../host';
import type { CodegenError, CodegenStore } from './state';
import { stackFor, targetsFor, type Stacks } from '../stacks';

export interface RunOptions {
  readonly host: CodegenHost;
  readonly stacks: Stacks;
  /** Все цели точки: стеку уходят его собственные и общие, без заменённых. */
  readonly targets: readonly CodegenTarget[];
  readonly documentId: ResourceId;
  readonly store: CodegenStore;
  /**
   * Имя формы; пустое — его называет стек (из имени файла). Задаёт имена в коде (тип, страница,
   * фабрики), но не место модуля: его решает стек по адресу документа.
   */
  readonly formName?: string;
  /**
   * Отказы, случившиеся ДО прогона, — разбор пользовательских целей.
   *
   * Показываются там же, где отказы печати, и по той же причине: человек смотрит
   * в панель после нажатия «Сгенерировать», и «мой шаблон не подхватился» обязан
   * объясниться именно там, а не в исчезнувшем тосте.
   */
  readonly problems?: readonly CodegenProblem[];
}

/** Отказ стека — отказом прогона, ключом его словаря. */
export function stackError(stackId: string, refusal: CodegenRefusal): CodegenError {
  return {
    key: refusal.refusal.key,
    stack: stackId,
    ...(refusal.refusal.params === undefined ? {} : { params: refusal.refusal.params }),
    ...(refusal.detail === undefined ? {} : { detail: refusal.detail }),
  };
}

/**
 * Напечатать и записать модуль формы. Ничего не бросает при предвиденных отказах: они
 * приземляются в состояние ключом словаря.
 */
export async function runCodegen(options: RunOptions): Promise<void> {
  const { host, stacks, documentId, store } = options;
  const document = host.documentOf(documentId);
  if (document === null) {
    store.patch({ phase: 'idle', error: { key: 'error.no-document' } });
    return;
  }

  // Документ, который не печатает ни один стек, и документ, в котором стек не узнал своей формы, —
  // для человека одно и то же: «это не схема формы».
  const entry = stackFor(stacks, document);
  const opened = entry === null ? null : await entry.stack.open(document, host);
  if (entry === null || opened === null) {
    store.patch({ phase: 'idle', error: { key: 'error.not-a-schema' }, stack: null });
    return;
  }
  const { stack } = entry;
  if (isCodegenRefusal(opened)) {
    store.patch({ phase: 'idle', error: stackError(stack.id, opened), stack: stack.id });
    return;
  }

  const formName = (options.formName ?? '').trim() || opened.formName;
  store.patch({ phase: 'running', error: null, delivery: null, stack: stack.id });

  const module = await opened.print({
    targets: targetsFor(options.targets, stack),
    formName,
    format: host.format,
  });

  const problems = [...(options.problems ?? []), ...module.problems];
  const files = module.files.map((file) => ({
    path: file.path,
    cls: file.cls,
    targetId: file.targetId,
    origin: file.origin,
  }));
  const report = {
    phase: 'idle' as const,
    formName,
    files,
    snippet: module.snippet,
    problems,
    view: module.view,
    rootPath: opened.rootPath,
  };

  try {
    const delivery = await deliverInto(host, opened.root, module.files, module);
    store.patch({ ...report, delivery, error: null });
  } catch (error) {
    store.patch({
      ...report,
      delivery: null,
      error:
        error instanceof SourceReadOnlyError
          ? { key: 'error.read-only' }
          : error instanceof DeliveryRefusedError
            ? stackError(stack.id, error.refusal)
            : { key: 'error.failed' },
    });
    // Оба отказа — ответ, а не поломка: о них говорит панель, и ничего не записано.
    if (!(error instanceof SourceReadOnlyError) && !(error instanceof DeliveryRefusedError)) {
      throw error;
    }
  }
}
