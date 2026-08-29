/**
 * Вытеснение материализованного — чистая политика над снимком рабочей области.
 *
 * Четыре правила, и каждое отвечает на вопрос, который иначе решался бы по вкусу:
 *
 * - **Открытые ресурсы закреплены** и не вытесняются никогда. Вытесненная вкладка означала бы
 *   поход в источник при следующем нажатии клавиши.
 * - **Догруженные зависимости** вытесняются по давности использования — но **не раньше**,
 *   чем перестанут быть нужны хоть одному открытому документу. Открытая схема без своего
 *   сайдкара не собирается, и «зависимость вытеснилась, потому что её давно не читали»
 *   выглядело бы как случайная поломка формы.
 * - **`close` снимает закрепление, а не удаляет.** Физическое удаление ленивое: закрыть
 *   и открыть тот же файл не должно означать повторный поход в источник.
 * - **BASE вытесняется в паре с содержимым.** Выброшенный в одиночку BASE — это потеря
 *   возможности трёхстороннего слияния при живой рабочей копии; исполняется парность
 *   в `WorkspaceFileStore.removePair`, а здесь — в том, что план оперирует ресурсом целиком.
 *
 * **Пятое правило, которого нет в контракте, но без которого он не выполним:** изменённый
 * ресурс не вытесняется. Рабочая копия — единственное место, где живёт несохранённая правка;
 * выбросить её значит потерять работу молча, а вытеснение по определению происходит без
 * ведома пользователя. Поэтому `dirty` защищает так же, как закрепление.
 *
 * Модуль намеренно чистый: он не ходит ни в OPFS, ни в IndexedDB. Исполнение плана —
 * у Workspace, а решение «кого» проверяется без единой асинхронной операции.
 *
 * @module host/workspace/eviction
 */

/** Один материализованный ресурс глазами политики вытеснения. */
export interface EvictionEntry {
  readonly path: string;
  /** Размер рабочей копии в байтах. BASE в счёт не идёт: он вытесняется парой и не выбирается. */
  readonly size: number;
  /** Давность использования: чем меньше, тем раньше кандидат. */
  readonly lastUsedAt: number;
  /** Есть несохранённые правки — защищён. */
  readonly dirty: boolean;
  /** Ресурс открыт — закреплён. */
  readonly pinned: boolean;
  /** Ресурс нужен замыканию хотя бы одного открытого документа — защищён. */
  readonly required: boolean;
}

/** Потолок рабочей области целиком — не путать с бюджетом одной догрузки. */
export interface EvictionBudget {
  readonly files: number;
  readonly bytes: number;
}

/**
 * Умолчание. Заведомо больше одного замыкания (200 файлов / 8 МБ) — иначе открытие
 * одного документа немедленно вытесняло бы собственные зависимости и уходило в цикл
 * «догрузил — выбросил — догрузил».
 */
export const DEFAULT_EVICTION_BUDGET: EvictionBudget = Object.freeze({
  files: 500,
  bytes: 32 * 1024 * 1024,
});

/** Что политика решила. */
export interface EvictionPlan {
  /** Кого выбрасывать, в порядке вытеснения — от самого давнего. */
  readonly evict: readonly string[];
  /** Сколько файлов останется. */
  readonly files: number;
  /** Сколько байт останется. */
  readonly bytes: number;
  /**
   * Потолок превышен, но выбрасывать больше некого: всё оставшееся закреплено, нужно
   * открытым или изменено.
   *
   * Это законное состояние, а не ошибка: правила защиты сильнее потолка — потерять
   * несохранённую правку или зависимость открытого документа хуже, чем занять лишнее место.
   * Вызывающему это нужно, чтобы сказать вслух, а не чтобы чинить молча.
   */
  readonly retainedOverBudget: boolean;
}

/** Пустой план: перерасхода нет, трогать некого. */
function nothingToDo(files: number, bytes: number): EvictionPlan {
  return { evict: [], files, bytes, retainedOverBudget: false };
}

/**
 * Кого вытеснять, чтобы уложиться в потолок.
 *
 * Порядок кандидатов — по возрастанию `lastUsedAt`, при равенстве — по пути: политика обязана
 * быть детерминированной, иначе тест на неё падает через раз, а поведение зависит от порядка
 * обхода `Map`.
 */
export function planEviction(
  entries: readonly EvictionEntry[],
  budget: EvictionBudget = DEFAULT_EVICTION_BUDGET
): EvictionPlan {
  let files = entries.length;
  let bytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  if (files <= budget.files && bytes <= budget.bytes) return nothingToDo(files, bytes);

  const candidates = entries
    .filter((entry) => !entry.pinned && !entry.required && !entry.dirty)
    .sort((a, b) => a.lastUsedAt - b.lastUsedAt || a.path.localeCompare(b.path));

  const evict: string[] = [];
  for (const candidate of candidates) {
    if (files <= budget.files && bytes <= budget.bytes) break;
    evict.push(candidate.path);
    files -= 1;
    bytes -= candidate.size;
  }

  return {
    evict,
    files,
    bytes,
    retainedOverBudget: files > budget.files || bytes > budget.bytes,
  };
}
