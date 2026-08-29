/**
 * Состояние превью, живущее ВНЕ поверхности.
 *
 * Решение контракта: «если состояние не внутри компонента, поверхности можно свободно
 * размонтировать при переключении». Отсюда весь модуль: выбор поверхности, выделение и находки
 * сборки принадлежат документу, а не тому, что сейчас смонтировано. Переключение поверхности
 * поэтому стоит ровно одного размонтирования и ничего не теряет.
 *
 * ## Снимок стабилен по ссылке
 *
 * `get()` возвращает ту же ссылку, пока ничего не изменилось: снимок читает
 * `useSyncExternalStore`, который сравнивает ПО ССЫЛКЕ и падает с «The result of getSnapshot
 * should be cached» на новом объекте при каждом вызове. Та же дисциплина, что у сеансов
 * редактора схемы и у сервиса китов.
 *
 * ## Находки замещаются по источнику
 *
 * `report(source, …)` не добавляет, а ЗАМЕЩАЕТ список источника — ровно как
 * `DiagnosticsService.publish`. Иначе исправленная ошибка сборки осталась бы висеть после
 * пересборки, и панель показывала бы историю, а не состояние.
 *
 * ## Чего здесь нет
 *
 * Мок-данных. По контракту они живут в OPFS рядом с рабочей копией как авторский артефакт,
 * а не в памяти панели: их можно выгрузить в файл и положить в проект. Хранилища под них
 * плагину сегодня никто не даёт (см. шапку `./index`), поэтому поле в состоянии не заводится —
 * пустое место честнее места, которое незаметно потеряет содержимое при закрытии вкладки.
 *
 * @module plugins/preview/store
 */

import type { Disposable, NodeId } from '@/sdk';
import type { PreviewProblem } from './contract';

/** Снимок состояния превью одного документа. */
export interface PreviewState {
  /** Выбор человека; `null` — решает правило умолчания ({@link './selection'.chooseSurface}). */
  readonly surfaceId: string | null;
  readonly selection: readonly NodeId[];
  /** Находки всех источников, слитые в один список в порядке источников. */
  readonly problems: readonly PreviewProblem[];
}

export interface PreviewStore {
  get(): PreviewState;
  subscribe(cb: () => void): Disposable;
  /** Выбрать поверхность руками; `null` — вернуть решение правилу. */
  chooseSurface(id: string | null): void;
  select(ids: readonly NodeId[]): void;
  report(source: string, problems: readonly PreviewProblem[]): void;
}

const NO_PROBLEMS: readonly PreviewProblem[] = Object.freeze([]);
const NO_SELECTION: readonly NodeId[] = Object.freeze([]);

export function createPreviewStore(): PreviewStore {
  const bySource = new Map<string, readonly PreviewProblem[]>();
  const listeners = new Set<() => void>();

  let state: PreviewState = Object.freeze({
    surfaceId: null,
    selection: NO_SELECTION,
    problems: NO_PROBLEMS,
  });

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Политика всех хранилищ оболочки: упавший подписчик не мешает остальным.
        console.error('[preview] подписчик состояния упал', error);
      }
    }
  };

  const commit = (next: PreviewState): void => {
    state = Object.freeze(next);
    notify();
  };

  return {
    get: () => state,

    subscribe(cb) {
      listeners.add(cb);
      return {
        dispose(): void {
          listeners.delete(cb);
        },
      };
    },

    chooseSurface(id) {
      if (id === state.surfaceId) return;
      commit({ ...state, surfaceId: id });
    },

    select(ids) {
      if (sameIds(ids, state.selection)) return;
      commit({ ...state, selection: Object.freeze([...ids]) });
    },

    report(source, problems) {
      const previous = bySource.get(source);
      if (previous !== undefined && sameProblems(previous, problems)) return;
      // Пустой список — это «у меня чисто», и он обязан СНИМАТЬ прошлые находки источника,
      // а не оставлять его запись пустой: иначе порядок слияния зависел бы от истории.
      if (problems.length === 0) bySource.delete(source);
      else bySource.set(source, Object.freeze([...problems]));
      commit({ ...state, problems: mergeProblems(bySource) });
    },
  };
}

function mergeProblems(
  bySource: ReadonlyMap<string, readonly PreviewProblem[]>
): readonly PreviewProblem[] {
  if (bySource.size === 0) return NO_PROBLEMS;
  const out: PreviewProblem[] = [];
  for (const items of bySource.values()) out.push(...items);
  return Object.freeze(out);
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Сравнение находок по содержимому, а не по ссылке.
 *
 * Пересборка превью выдаёт НОВЫЕ объекты с теми же полями, и без этого сравнения каждая
 * пересборка меняла бы снимок — то есть перерисовывала бы панель на каждое нажатие клавиши
 * в редакторе, ничего при этом не меняя на экране.
 */
function sameProblems(a: readonly PreviewProblem[], b: readonly PreviewProblem[]): boolean {
  return (
    a.length === b.length &&
    a.every((item, index) => {
      const other = b[index];
      return (
        item.file === other.file && item.phase === other.phase && item.message === other.message
      );
    })
  );
}
