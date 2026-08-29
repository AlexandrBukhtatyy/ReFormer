/**
 * «Открыть с помощью»: выбор редактора, сделанный человеком, и правило его применения.
 *
 * ## Зачем это существует
 *
 * Редактор выбирается по приоритету `canOpen` (см. `./editors`), и выбор этот единственный:
 * у кого число больше, тот и рисует. Пока «открыть другим» нет вовсе, приоритет означает
 * не предпочтение, а ЗАПРЕТ — файл, за который взялся структурный редактор, текстом
 * не открыть ни при каком сценарии. Это уже стоило одной невидимой возможности: разметка
 * диагностики в Monaco написана и покрыта тестами, но недостижима, потому что документ
 * со схемой формы всегда достаётся канвасу (приоритет 100 против 10).
 *
 * Поэтому выбор человека — не «настройка вида», а вторая половина того же правила: приоритет
 * решает, чем открыть ПО УМОЛЧАНИЮ, а выбор — чем открыть ЭТОТ документ.
 *
 * ## Выбор помнится по ресурсу, а не в состоянии компонента
 *
 * Хранилище живёт столько же, сколько центр оболочки, — как и {@link
 * './editors'.ViewStateStore}, и по той же причине: `useState` внутри тела редактора
 * умирает вместе с ним, а тело пересоздаётся на каждой смене пары «редактор + документ»,
 * то есть ровно при том действии, которое выбор и совершает. Выбранный текстовый редактор
 * сбрасывался бы в момент, когда он открылся.
 *
 * Ключ — `ResourceId`, потому что вкладка это и есть открытый ресурс (см. шапку `./tabs`).
 * Переключение на соседнюю вкладку и обратно выбор сохраняет; закрытие и повторное открытие
 * файла — тоже, и это НЕ побочный эффект: человек, открывший схему текстом, чтобы поправить
 * то, чего канвас не показывает, при следующем открытии хочет продолжить, а не выбирать заново.
 *
 * Между сессиями выбор не переживает: он в памяти. Запись в настройки означала бы, что
 * снятый плагин оставляет за собой ссылку на несуществующий редактор в файле настроек,
 * а лечится это ровно тем же откатом на умолчание, который и так происходит.
 *
 * ## Выбор проверяется на каждой отрисовке, а не запоминается решением
 *
 * Хранится ИДЕНТИФИКАТОР, а применяется он через {@link pickEditor}, которая ищет его среди
 * сегодняшних кандидатов. Значит выбор автоматически отваливается, когда плагин сняли или
 * когда содержимое изменилось так, что редактор за него больше не берётся, — и отваливается
 * молча в правильную сторону: на умолчание, а не в «редактора нет».
 *
 * @module host/ui/editor-choice
 */

import { toDisposable, type Disposable } from '../primitives/disposable';
import type { ResourceId } from '../primitives/resource';
import type { EditorCandidate, EditorEntry } from './editors';

/** Снимок выбора: ресурс → идентификатор редактора. Между изменениями — та же ссылка. */
export type EditorChoices = ReadonlyMap<ResourceId, string>;

/**
 * Пусто. Одна ссылка на все пустые снимки — её читает `useSyncExternalStore`.
 *
 * `Object.freeze` здесь бессилен (заморозка не мешает `Map.set`), и подделывать защиту
 * нечем: от правки снаружи бережёт тип, а не рантайм. Внутрь хранилища этот объект
 * не попадает — `commit` всегда строит новую карту.
 */
export const NO_CHOICES: EditorChoices = new Map<ResourceId, string>();

/**
 * Хранилище выбора редактора. Живёт вне React — как и остальные хранилища оболочки.
 */
export interface EditorChoiceStore {
  /** Снимок. Ссылка стабильна между изменениями. */
  get(): EditorChoices;
  subscribe(listener: () => void): Disposable;
  /** Что выбрано для ресурса; `null` — решает приоритет. */
  chosenFor(resource: ResourceId): string | null;
  /** Запоминает выбор. Повторный выбор того же редактора ничего не меняет. */
  choose(resource: ResourceId, editorId: string): void;
  /** Возвращает решение приоритету. */
  reset(resource: ResourceId): void;
}

export function createEditorChoiceStore(): EditorChoiceStore {
  let choices: EditorChoices = NO_CHOICES;
  const listeners = new Set<() => void>();

  const commit = (next: Map<ResourceId, string>): void => {
    choices = next.size === 0 ? NO_CHOICES : next;
    // Копия набора и терпимость к падению подписчика — политика всех хранилищ оболочки.
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[shell] подписчик выбора редактора упал', error);
      }
    }
  };

  return {
    get: () => choices,

    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },

    chosenFor: (resource) => choices.get(resource) ?? null,

    choose(resource, editorId) {
      if (choices.get(resource) === editorId) return;
      commit(new Map(choices).set(resource, editorId));
    },

    reset(resource) {
      if (!choices.has(resource)) return;
      const next = new Map(choices);
      next.delete(resource);
      commit(next);
    },
  };
}

/**
 * Редактор, которым рисовать документ: выбранный человеком, иначе — с наибольшим приоритетом.
 *
 * `chosenId`, которого нет среди кандидатов, ИГНОРИРУЕТСЯ, а не превращается в отказ:
 * плагин могли выключить, а содержимое — изменить так, что редактор перестал за него браться.
 * Показать в этом случае «редактора нет» значило бы наказать человека за чужую перезагрузку.
 */
export function pickEditor(
  candidates: readonly EditorCandidate[],
  chosenId: string | null
): EditorEntry | null {
  if (chosenId !== null) {
    const chosen = candidates.find((candidate) => candidate.entry.value.id === chosenId);
    if (chosen !== undefined) return chosen.entry;
  }
  return candidates[0]?.entry ?? null;
}
