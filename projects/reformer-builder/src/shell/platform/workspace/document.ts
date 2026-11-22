/**
 * Буфер открытого документа и ручки управления им.
 *
 * Объявление (`Document`, `DocumentKind`) живёт в пакете `@reformer/builder-plugin-api`,
 * и там же записано правило, на котором держится всё остальное: `getText` — это то, что уйдёт
 * в файл при сохранении. Здесь — то, что наружу не выдаётся: мутаторы остаются у создавшего.
 *
 * @module shell/platform/workspace/document
 */

import {
  toDisposable,
  type Document,
  type ResourceRef,
} from '@reformer/builder-plugin-api/internal';

/**
 * Документ вместе с ручками управления им.
 *
 * Разведение намеренное: наружу (в редакторы, панели, ассистента) уходит {@link Document},
 * который менять нельзя иначе как через Workspace, а мутаторы остаются у того, кто документ
 * создал. Без разведения любой держатель ссылки мог бы записать в буфер мимо рабочей копии —
 * и `save` начал бы писать не то, что лежит в OPFS.
 */
export interface DocumentHandle {
  readonly document: Document;
  /** Заменяет буфер целиком и уведомляет подписчиков, если текст действительно другой. */
  setText(text: string): void;
  /** Отмечает расхождение с BASE. Считает его Workspace: сравнение требует чтения обоих слоёв. */
  setDirty(dirty: boolean): void;
}

/**
 * Создаёт документ поверх уже прочитанного текста.
 *
 * Текст передаётся, а не читается здесь: документ не знает ни про источник, ни про хранилище —
 * это знание Workspace, и протечь оно не должно ни в редактор, ни в модель.
 */
export function createDocument(ref: ResourceRef, text: string, dirty: boolean): DocumentHandle {
  let content = text;
  let isDirty = dirty;
  const listeners = new Set<(text: string) => void>();

  const document: Document = {
    // Всегда `'text'`: провайдера модели буфер не знает и знать не должен. Документ становится
    // модельным не здесь, а надстройкой над этим буфером — см. `model/model-document.ts`.
    kind: 'text',
    id: ref.id,
    ref,
    getText: () => content,
    isDirty: () => isDirty,
    onDidChangeContent(cb) {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },
  };

  return {
    document,
    setText(next) {
      // Равный текст — не событие: `writeText` дебаунсится и приходит повторно с тем же
      // содержимым, а перерисовка редактора на каждый такой вызов сбрасывала бы выделение.
      if (next === content) return;
      content = next;
      // Снимок: подписка, снятая обработчиком, не должна получить это же уведомление.
      for (const listener of [...listeners]) {
        try {
          listener(content);
        } catch (err) {
          // Упавший подписчик не рвёт правку, которая уже состоялась, — см. `event.ts`.
          console.error('[workspace] подписчик документа упал; правка не отменена', err);
        }
      }
    },
    setDirty(next) {
      isDirty = next;
    },
  };
}
