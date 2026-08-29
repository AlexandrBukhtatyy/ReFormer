/**
 * Связь Monaco с буфером документа — целиком, и целиком чистой функцией.
 *
 * Это главное правило редактора, и записано оно в `docs/editors-and-preview.md`:
 *
 * ```text
 * буфер документа           истина для текстового документа
 * текст модельного          проекция модели: перерисовывается из print(model)
 * перерисовка при фокусе    ОТКЛАДЫВАЕТСЯ — иначе затрём то, что человек печатает сейчас
 * правка в Monaco           идёт в буфер через рабочую область, а не в модель
 * ```
 *
 * ## Почему редуктор, а не проверки внутри компонента
 *
 * Окружение тестов — `node`, Monaco в нём не поднять. Значит правило, которое дороже всего
 * ошибиться, обязано быть проверяемым без Monaco: {@link reduceSync} принимает снимок
 * («что пришло», «что сейчас в редакторе», «в фокусе ли он») и отвечает ДЕЙСТВИЕМ.
 * Компонент остаётся исполнителем: он умеет положить текст в редактор и записать текст
 * в рабочую копию, а решать — не его работа.
 *
 * ## Эхо
 *
 * `writeText` асинхронна: своя же правка возвращается событием буфера через несколько
 * тактов. Без отсеивания редактор принял бы собственный текст за внешнюю правку и положил
 * бы его обратно — с прыжком каретки в конец на каждом символе. Поэтому отправленное
 * запоминается ДО записи и снимается, когда вернулось (или когда запись отказала).
 *
 * Одного «последнего отправленного» мало: при быстром наборе в пути оказывается несколько
 * текстов сразу, и вернутся они по очереди. Отсюда список, а не строка, — тот же приём,
 * что и в `host/workspace/model/model-document.ts`.
 *
 * ## Приоритет у того, кто печатает
 *
 * Отложенная перерисовка **отменяется**, если человек тем временем набрал своё: его текст —
 * та истина, которую он видит. Иначе уход фокуса вернул бы на экран состояние, отменённое
 * пять секунд назад.
 *
 * @module plugins/editor-monaco/sync
 */

/** Состояние связи. Неизменяемое: каждый шаг отдаёт новое, старое годится для сравнения в тесте. */
export interface SyncState {
  /**
   * Текст, ждущий перерисовки: пришёл извне, пока редактор был в фокусе.
   *
   * `null` — ждать нечего. Второй такой текст вытесняет первый: показывать надо последнее
   * состояние документа, а не историю того, как оно набежало.
   */
  readonly pending: string | null;
  /** Отправленные в рабочую копию тексты, чьё эхо ещё не вернулось. */
  readonly echoes: readonly string[];
}

/** Событие, на которое реагирует связь. Снимок полей, а не объект браузера, — ради `node`. */
export type SyncEvent =
  /** Человек напечатал: в редакторе уже новый текст. */
  | { readonly kind: 'typed'; readonly text: string }
  /** Буфер документа сменился: своей записью, откатом, слиянием или перерисовкой по модели. */
  | {
      readonly kind: 'buffer';
      readonly text: string;
      /** Что сейчас показывает Monaco. */
      readonly editorText: string;
      /** В фокусе ли Monaco ЭТОГО документа. */
      readonly focused: boolean;
    }
  /** Запись в рабочую копию завершилась — успехом или отказом; эхо ждать больше нечего. */
  | { readonly kind: 'written'; readonly text: string }
  /** Фокус ушёл: отложенное больше ничто не держит. */
  | { readonly kind: 'blur'; readonly editorText: string };

/** Что обязан сделать компонент. Ровно три исхода, и «ничего» — полноценный из них. */
export type SyncAction =
  | { readonly kind: 'none'; readonly reason: NoActionReason }
  /** Положить текст в модель Monaco, не разрушая его историю отмены. */
  | { readonly kind: 'apply'; readonly text: string }
  /** Записать текст в рабочую копию через рабочую область. */
  | { readonly kind: 'write'; readonly text: string };

/**
 * Почему ничего не делаем. Причина — часть контракта, а не отладка: по ней проверяется,
 * что «не перерисовали» случилось по фокусу, а не потому, что текст совпал случайно.
 */
export type NoActionReason =
  /** Вернулась своя же запись. */
  | 'echo'
  /** В редакторе уже ровно этот текст. */
  | 'same'
  /** Редактор в фокусе: перерисовка отложена. */
  | 'focused'
  /** Откладывать было нечего. */
  | 'no-pending';

export interface SyncOutcome {
  readonly state: SyncState;
  readonly action: SyncAction;
}

/** Начальное состояние: ничего не отложено, ничего не отправлено. */
export function createSyncState(): SyncState {
  return { pending: null, echoes: [] };
}

/** Снимает ОДНО вхождение: при наборе «a → ab → a» один и тот же текст в пути дважды. */
function withoutOne(echoes: readonly string[], text: string): readonly string[] {
  const at = echoes.indexOf(text);
  if (at === -1) return echoes;
  return [...echoes.slice(0, at), ...echoes.slice(at + 1)];
}

const NOTHING = (state: SyncState, reason: NoActionReason): SyncOutcome => ({
  state,
  action: { kind: 'none', reason },
});

/**
 * Шаг связи: состояние и событие на входе, новое состояние и действие на выходе.
 *
 * Порядок проверок для события буфера несущий:
 *
 * 1. **эхо** — раньше сравнения с текстом редактора, потому что своё эхо обычно ему и равно,
 *    а снять его из списка надо в любом случае: иначе список растёт весь сеанс;
 * 2. **совпадение** — перерисовывать нечем, и `apply` здесь сбросил бы выделение зря;
 * 3. **фокус** — откладываем; это и есть то самое правило, ради которого модуль существует;
 * 4. **перерисовка**.
 */
export function reduceSync(state: SyncState, event: SyncEvent): SyncOutcome {
  switch (event.kind) {
    case 'typed':
      // Печать отменяет отложенную перерисовку: приоритет у того, кто печатает.
      return {
        state: { pending: null, echoes: [...state.echoes, event.text] },
        action: { kind: 'write', text: event.text },
      };

    case 'written':
      return NOTHING({ ...state, echoes: withoutOne(state.echoes, event.text) }, 'echo');

    case 'buffer': {
      if (state.echoes.includes(event.text)) {
        return NOTHING({ ...state, echoes: withoutOne(state.echoes, event.text) }, 'echo');
      }
      if (event.text === event.editorText) return NOTHING({ ...state, pending: null }, 'same');
      if (event.focused) {
        return {
          state: { ...state, pending: event.text },
          action: { kind: 'none', reason: 'focused' },
        };
      }
      return { state: { ...state, pending: null }, action: { kind: 'apply', text: event.text } };
    }

    case 'blur': {
      const pending = state.pending;
      if (pending === null) return NOTHING(state, 'no-pending');
      if (pending === event.editorText) return NOTHING({ ...state, pending: null }, 'same');
      return { state: { ...state, pending: null }, action: { kind: 'apply', text: pending } };
    }
  }
}
