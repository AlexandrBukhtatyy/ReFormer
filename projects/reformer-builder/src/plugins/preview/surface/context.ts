/**
 * Контекст поверхности: то, что превью даёт смонтированной поверхности, и ничего сверх.
 *
 * ## Схема кэшируется до следующей правки
 *
 * `schema()` обязана возвращать ТУ ЖЕ ссылку, пока буфер не менялся. Причина не в экономии
 * разбора, а в том, что ссылку сравнивают: рантайм-поверхность пересобирает форму по изменению
 * схемы, и новый объект на каждый вызов означал бы пересборку формы на каждый кадр — с потерей
 * введённых значений.
 *
 * ## Разбор не бросает
 *
 * Недописанный JSON — законное содержимое буфера, а не сбой. Поэтому `schema()` отвечает `null`,
 * а поверхность показывает это словами. Бросок отсюда уронил бы поверхность, и человек увидел бы
 * пустоту вместо объяснения.
 *
 * @module plugins/preview/surface/context
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { Disposable, DocumentRef, NodeId } from '@/sdk';
import type { PreviewContext, PreviewMock, PreviewProblem, PreviewValues } from '../contract';
import { schemaOf } from '../schema/document';
import type { PreviewDocument } from '../host';
import type { PreviewStore } from '../state/store';

/** Ссылка на документ в том виде, в каком её ждёт `PreviewSurface.applies`. */
export function documentRefOf(document: PreviewDocument): DocumentRef {
  return { id: document.id, ref: document.ref, kind: document.kind };
}

export interface PreviewContextDeps {
  readonly document: PreviewDocument;
  readonly store: PreviewStore;
  /** Мок-данные автора; без него поверхность синтезирует свои. */
  readonly mock?: () => PreviewMock | null;
}

/** Контекст вместе с освобождением подписки на документ. */
export type OwnedPreviewContext = PreviewContext & Disposable;

export function createPreviewContext(deps: PreviewContextDeps): OwnedPreviewContext {
  const { document, store } = deps;
  const doc = documentRefOf(document);

  /** `undefined` — ещё не разбирали; `null` — разобрать не удалось. Разные состояния. */
  let cached: JsonFormSchema | null | undefined;
  const listeners = new Set<() => void>();

  const subscription = document.onDidChangeContent(() => {
    cached = undefined;
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[preview] подписчик схемы упал', error);
      }
    }
  });

  return {
    doc,

    schema(): JsonFormSchema | null {
      if (cached === undefined) cached = schemaOf(document);
      return cached;
    },

    onDidChangeSchema(cb: () => void): Disposable {
      listeners.add(cb);
      return {
        dispose(): void {
          listeners.delete(cb);
        },
      };
    },

    selection(): readonly NodeId[] {
      return store.get().selection;
    },

    onDidChangeSelection(cb: () => void): Disposable {
      return store.subscribe(cb);
    },

    select(ids: readonly NodeId[]): void {
      store.select(ids);
    },

    mock(): PreviewMock | null {
      return deps.mock?.() ?? null;
    },

    values(): PreviewValues | undefined {
      return store.values();
    },

    publishForm(form): void {
      store.publishForm(form);
    },

    keepValues(next: PreviewValues): void {
      store.keepValues(next);
    },

    report(source: string, problems: readonly PreviewProblem[]): void {
      store.report(source, problems);
    },

    dispose(): void {
      subscription.dispose();
      listeners.clear();
    },
  };
}
