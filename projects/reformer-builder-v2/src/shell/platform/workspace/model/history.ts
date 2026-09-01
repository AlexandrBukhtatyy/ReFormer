/**
 * История правок — два механизма, потому что материал разный.
 *
 * |            | `ModelDocument`                                  | `TextDocument`                                    |
 * | ---------- | ------------------------------------------------ | ------------------------------------------------- |
 * | Механизм   | снимки                                           | патчи                                             |
 * | Почему     | structural sharing делает снимок тремя указателями | у текста разделять нечего; снимок — полная строка |
 * | Откуда     | из `apply(model, op)`                            | редактор отдаёт дельты сам                        |
 *
 * Симметрия обманчива, и это стоит проговорить: **для модели патчи были бы хуже снимков,
 * а для текста — лучше.** Причина одна и та же — свойства данных. Модель разделяет неизменяемую
 * структуру, поэтому снимок почти ничего не стоит; текст не разделяет ничего, зато редактор
 * выдаёт готовые дельты с диапазоном и вставкой бесплатно.
 *
 * ## Отмена и журнал — разные вещи
 *
 * Здесь только отмена: стек в памяти документа, переживать перезагрузку не обязан. Журнал
 * изменений (append-only, IndexedDB, опорные снимки, политика хранения) — отдельная машинерия
 * и отдельная задача; общее у них — формат {@link TextEdit} и `EditOp`, чтобы одну и ту же
 * правку не описывать дважды.
 *
 * @module host/workspace/model/history
 */

import type { NodeId } from './provider';

/*
 * ─────────────────────────────  текст: патчи  ─────────────────────────────
 */

/**
 * Правка текста, не зависящая от того, кто её породил.
 *
 * **Смещения — в кодовых единицах UTF-16.** Названо намеренно: JavaScript и Monaco считают
 * именно так, и потребитель, решивший, что это байты или кодовые точки, сломается на первом
 * же эмодзи. Написать это один раз дешевле, чем ловить потом.
 *
 * **`removed` хранится, хотя для проигрывания вперёд не нужен.** Он делает запись
 * самодостаточной: шаг назад не требует поиска базы, а потребитель понимает правку, не имея
 * документа. Для набора текста это почти всегда пустая строка, так что цена низкая.
 */
export interface TextEdit {
  readonly offset: number;
  readonly removed: string;
  readonly inserted: string;
}

/**
 * Применяет пакет правок.
 *
 * **Все смещения в пакете отсчитываются от текста ДО пакета**, правки не пересекаются —
 * ровно так их отдаёт редактор в одном событии изменения. Применение идёт с конца, чтобы
 * ранние смещения не сдвигались.
 *
 * `removed` сверяется с тем, что лежит в тексте. Это не педантизм: патч, применённый
 * не к своему основанию, даёт правдоподобный, но неверный текст — а такую порчу обнаруживают
 * через день и не связывают с историей.
 *
 * @throws если смещение выходит за пределы текста, правки пересекаются или `removed`
 *   не совпадает с содержимым.
 */
export function applyTextEdits(text: string, edits: readonly TextEdit[]): string {
  if (edits.length === 0) return text;
  const ordered = [...edits].sort((a, b) => a.offset - b.offset);

  let previousEnd = -1;
  for (const edit of ordered) {
    const end = edit.offset + edit.removed.length;
    if (edit.offset < 0 || end > text.length) {
      throw new Error(
        `патч выходит за пределы текста: [${edit.offset}, ${end}) при длине ${text.length}`
      );
    }
    if (edit.offset < previousEnd) {
      throw new Error(`патчи пересекаются на смещении ${edit.offset}`);
    }
    if (text.slice(edit.offset, end) !== edit.removed) {
      throw new Error(
        `патч не соответствует основанию на смещении ${edit.offset}: ` +
          `ожидалось «${edit.removed}», в тексте «${text.slice(edit.offset, end)}»`
      );
    }
    previousEnd = end;
  }

  let result = text;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const edit = ordered[i];
    result =
      result.slice(0, edit.offset) +
      edit.inserted +
      result.slice(edit.offset + edit.removed.length);
  }
  return result;
}

/**
 * Обращает пакет: результат применим к тексту ПОСЛЕ исходного пакета и возвращает его назад.
 *
 * Смещения пересчитываются: вставка сдвигает всё, что правее неё, поэтому обратная правка
 * лежит не там же, где прямая.
 */
export function invertTextEdits(edits: readonly TextEdit[]): readonly TextEdit[] {
  const ordered = [...edits].sort((a, b) => a.offset - b.offset);
  let shift = 0;
  return ordered.map((edit) => {
    const inverse: TextEdit = {
      offset: edit.offset + shift,
      removed: edit.inserted,
      inserted: edit.removed,
    };
    shift += edit.inserted.length - edit.removed.length;
    return inverse;
  });
}

/** Старшая половина суррогатной пары. */
function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** Младшая половина суррогатной пары. */
function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/**
 * Одна правка, превращающая `before` в `after`: общий префикс и суффикс отбрасываются.
 *
 * Нужна там, где дельт не дали, — при записи буфера мимо редактора (правка ассистента,
 * откат к BASE, слияние). Полноценный diff здесь был бы лишним: журналу и отмене достаточно
 * знать, что именно заменилось.
 *
 * Границы не разрезают суррогатную пару. Формально это допустимо — смещения считаются
 * в кодовых единицах, и склейка вернула бы то же самое, — но в `removed`/`inserted` попадали
 * бы одинокие суррогаты, и первый же потребитель, который выведет патч человеку или измерит
 * его в кодовых точках, увидит мусор.
 */
export function diffText(before: string, after: string): readonly TextEdit[] {
  if (before === after) return [];

  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) {
    start += 1;
  }
  if (start > 0 && isHighSurrogate(before.charCodeAt(start - 1))) start -= 1;

  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore -= 1;
    endAfter -= 1;
  }
  // Старшая половина пары осталась в правке, а младшая ушла в общий суффикс — забираем
  // младшую обратно, чтобы пара не разъехалась по разные стороны границы.
  if (
    endBefore > start &&
    endBefore < before.length &&
    isHighSurrogate(before.charCodeAt(endBefore - 1)) &&
    isLowSurrogate(before.charCodeAt(endBefore))
  ) {
    endBefore += 1;
    endAfter += 1;
  }

  return [
    {
      offset: start,
      removed: before.slice(start, endBefore),
      inserted: after.slice(start, endAfter),
    },
  ];
}

/** Стек отмены для текстового документа. */
export interface TextHistory {
  /** Записывает совершённую правку. Ветка «вперёд» при этом теряется — как везде. */
  record(edits: readonly TextEdit[]): void;
  /** Текст на шаг назад или `undefined`, если отменять нечего. */
  undo(text: string): string | undefined;
  redo(text: string): string | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
  /** Глубина стека отмены — для тестов и для индикатора. */
  depth(): number;
}

export interface TextHistoryOptions {
  /** Сколько шагов держать. Самые старые вытесняются. */
  readonly limit?: number;
}

/** Умолчание глубины: столько шагов помнит и Monaco, дальше история уходит в журнал. */
const DEFAULT_HISTORY_LIMIT = 200;

/**
 * Стек патчей.
 *
 * В сессии Ctrl+Z в Monaco работает через его собственный стек, и подменять его не надо;
 * этот стек существует для документов без своего редактора, для отмены правок, пришедших
 * мимо редактора, и как источник записей журнала. Смешивать его с монаковским нельзя:
 * получилась бы двойная отмена — одно нажатие снимает две правки.
 */
export function createTextHistory(options: TextHistoryOptions = {}): TextHistory {
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT;
  const past: (readonly TextEdit[])[] = [];
  const future: (readonly TextEdit[])[] = [];

  return {
    record(edits) {
      if (edits.length === 0) return;
      past.push(edits);
      if (past.length > limit) past.shift();
      future.length = 0;
    },

    undo(text) {
      const edits = past.pop();
      if (edits === undefined) return undefined;
      const result = applyTextEdits(text, invertTextEdits(edits));
      future.push(edits);
      return result;
    },

    redo(text) {
      const edits = future.pop();
      if (edits === undefined) return undefined;
      const result = applyTextEdits(text, edits);
      past.push(edits);
      return result;
    },

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    clear() {
      past.length = 0;
      future.length = 0;
    },

    depth: () => past.length,
  };
}

/*
 * ─────────────────────────────  модель: снимки  ─────────────────────────────
 */

/**
 * Снимок состояния правки.
 *
 * **Выделение входит в снимок.** Оно не состояние вида, а часть модели правки: вставка
 * переносит выделение на новый узел, и отмена, вернувшая модель без выделения, оставила бы
 * пользователя смотреть на узел, которого больше нет. В `viewState` редактора уходит другое —
 * прокрутка, свёрнутые ветки, позиция каретки.
 */
export interface ModelSnapshot<M> {
  readonly model: M;
  readonly selection: readonly NodeId[];
}

export interface RecordOptions {
  /**
   * Ключ схлопывания, обычно `свойство@узел`.
   *
   * Соседние правки с одинаковым ключом сливаются в один шаг отмены — иначе набор текста
   * в поле забьёт стек и Ctrl+Z станет посимвольным. Без ключа правка не сливается ни с чем.
   */
  readonly mergeKey?: string;
}

export interface ModelHistory<M> {
  /**
   * Записывает состояние ДО правки — его и вернёт отмена.
   *
   * Хранить «до», а не «после», важно именно для схлопывания: слить два шага — значит
   * не записывать второй, и тогда отмена откатывает к состоянию до первого. С хранением
   * «после» то же самое потребовало бы переписывать вершину стека.
   */
  record(before: ModelSnapshot<M>, options?: RecordOptions): void;
  /**
   * Граница схлопывания: следующая правка не сольётся с предыдущей, даже с тем же ключом.
   *
   * Ставится там, где пользователь воспринимает действие как законченное: уход фокуса
   * с поля, конец хода ассистента, правка, пришедшая из текста.
   */
  breakMerge(): void;
  /** Возвращает состояние на шаг назад, приняв текущее для перехода вперёд. */
  undo(current: ModelSnapshot<M>): ModelSnapshot<M> | undefined;
  redo(current: ModelSnapshot<M>): ModelSnapshot<M> | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
  depth(): number;
}

export interface ModelHistoryOptions {
  readonly limit?: number;
}

interface Entry<M> {
  readonly snapshot: ModelSnapshot<M>;
  /** Ключ, с которым записан шаг; `undefined` — сливать с ним нельзя. */
  mergeKey: string | undefined;
}

/**
 * Стек снимков.
 *
 * Снимок при structural sharing — это три указателя: модель, массив выделения и сам объект
 * записи. Поэтому отмена на снимках дешевле журнала операций и остаётся снимками, а журнал
 * решает другую задачу и живёт отдельно.
 *
 * **Ход ассистента — одна запись отмены.** Механика та же, что у схлопывания: ассистент
 * применяет несколько операций с общим ключом, а границы ставятся до и после хода.
 */
export function createModelHistory<M>(options: ModelHistoryOptions = {}): ModelHistory<M> {
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT;
  const past: Entry<M>[] = [];
  const future: Entry<M>[] = [];

  return {
    record(before, recordOptions) {
      const mergeKey = recordOptions?.mergeKey;
      const top = past[past.length - 1];
      // Схлопывание — это НЕ запись: состояние «до» уже лежит на вершине, и второй шаг
      // с тем же ключом ничего к нему не добавляет.
      if (mergeKey !== undefined && top !== undefined && top.mergeKey === mergeKey) {
        future.length = 0;
        return;
      }
      past.push({ snapshot: before, mergeKey });
      if (past.length > limit) past.shift();
      future.length = 0;
    },

    breakMerge() {
      const top = past[past.length - 1];
      if (top !== undefined) top.mergeKey = undefined;
    },

    undo(current) {
      const entry = past.pop();
      if (entry === undefined) return undefined;
      // Шаг вперёд не сливается ни с чем: повторный Ctrl+Y обязан идти по одному шагу.
      future.push({ snapshot: current, mergeKey: undefined });
      return entry.snapshot;
    },

    redo(current) {
      const entry = future.pop();
      if (entry === undefined) return undefined;
      past.push({ snapshot: current, mergeKey: undefined });
      return entry.snapshot;
    },

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    clear() {
      past.length = 0;
      future.length = 0;
    },

    depth: () => past.length,
  };
}

/**
 * Ключ схлопывания `свойство@узел` — тот же, что в v1.
 *
 * Функция, а не соглашение о строке: ключ собирают и редактор, и инспектор, и ассистент,
 * и разъехавшийся формат означал бы, что схлопывание перестало работать молча.
 */
export function mergeKeyOf(property: string, node: NodeId): string {
  return `${property}@${node}`;
}
