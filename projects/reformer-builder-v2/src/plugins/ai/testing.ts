/**
 * Двойники платформы для юнитов моста.
 *
 * Порт ассистента (`./host`) держит ровно три глагола про рабочую область, поэтому двойник
 * получается маленьким — и это его главное свойство: тест моста не поднимает ни Workspace,
 * ни OPFS, ни оболочку, а поведение проверяет то же самое. Ровно ради этого платформа и
 * приходит портом, а не импортом.
 *
 * @module plugins/ai/testing
 */

import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import type { CatalogEntry } from '@/lib/catalog/types';
import type { Disposable, ResourceId } from '@/sdk';
import type { AiDocument, AiHost, Translate, WriteMark } from './host';

/** Двойник рабочей области: карта документов, активная вкладка и журнал записей. */
export interface FakeHost extends AiHost {
  /** Положить (или заменить) содержимое документа и сделать его активным. */
  openDocument(id: ResourceId, text: string): void;
  /** Заменить текст мимо `writeText` — как это делает правка руками во время хода. */
  editOutside(id: ResourceId, text: string): void;
  /** Закрыть вкладку: `documentOf` начнёт отвечать `null`. */
  closeDocument(id: ResourceId): void;
  /**
   * Что и в каком порядке ушло в `writeText`, вместе с пометкой происхождения.
   *
   * Пометка здесь не для полноты: без неё тест не отличает запись ассистента от записи
   * человека — а это ровно то свойство, ради которого канал пометки заведён.
   */
  readonly writes: readonly {
    readonly id: ResourceId;
    readonly text: string;
    readonly mark?: WriteMark;
  }[];
  /** Отказывать в записи этой ошибкой. */
  failWrites(error: Error | null): void;
  setActive(id: ResourceId | null): void;
}

/** Ключ и параметры одной строкой: тест сверяет КЛЮЧ, а не перевод. */
const echoTranslate: Translate = (key, params) =>
  params === undefined ? key : `${key} ${JSON.stringify(params)}`;

/** Собрать двойник платформы. */
export function createFakeHost(catalog: readonly CatalogEntry[] = builtinEntries()): FakeHost {
  const texts = new Map<ResourceId, string>();
  const listeners = new Map<ResourceId, Set<(text: string) => void>>();
  const writes: { id: ResourceId; text: string; mark?: WriteMark }[] = [];
  let active: ResourceId | null = null;
  let failure: Error | null = null;

  const notify = (id: ResourceId, text: string): void => {
    for (const listener of [...(listeners.get(id) ?? [])]) listener(text);
  };

  const documentFor = (id: ResourceId): AiDocument => ({
    ref: {
      id,
      sourceId: 'fake',
      path: String(id),
      name: String(id),
      kind: 'file',
      mediaType: 'application/json',
    },
    getText: () => texts.get(id) ?? '',
    onDidChangeContent(cb): Disposable {
      let set = listeners.get(id);
      if (set === undefined) {
        set = new Set();
        listeners.set(id, set);
      }
      set.add(cb);
      return {
        dispose: () => {
          set.delete(cb);
        },
      };
    },
  });

  return {
    useTranslate: () => echoTranslate,
    translate: echoTranslate,

    activeResource: () => active,
    documentOf: (id) => (texts.has(id) ? documentFor(id) : null),

    writeText(id, text, mark) {
      if (failure !== null) return Promise.reject(failure);
      writes.push({ id, text, ...(mark === undefined ? {} : { mark }) });
      texts.set(id, text);
      notify(id, text);
      return Promise.resolve();
    },

    catalog: () => catalog,

    openDocument(id, text) {
      texts.set(id, text);
      active = id;
    },

    editOutside(id, text) {
      texts.set(id, text);
      notify(id, text);
    },

    closeDocument(id) {
      texts.delete(id);
      listeners.delete(id);
      if (active === id) active = null;
    },

    writes,

    failWrites(error) {
      failure = error;
    },

    setActive(id) {
      active = id;
    },
  };
}
