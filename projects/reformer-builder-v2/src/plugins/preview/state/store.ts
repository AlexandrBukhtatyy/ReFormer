/**
 * Состояние превью, живущее ВНЕ поверхности.
 *
 * Решение контракта: «если состояние не внутри компонента, поверхности можно свободно
 * размонтировать при переключении». Отсюда весь модуль: выделение, находки сборки и введённые
 * значения принадлежат документу, а не тому, что сейчас смонтировано. Смена поверхности
 * поэтому стоит ровно одного размонтирования и ничего не теряет.
 *
 * Выбора поверхности здесь больше нет: он существовал ради переключателя в панели превью,
 * а панель ушла вместе с ней. Теперь поверхность назначает правило (`./selection`) по
 * объявленным возможностям и правам источника — то есть выбирать нечего и некому.
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
 * ## Введённые значения лежат ВНЕ снимка
 *
 * Форму пересобирают на каждую правку схемы, и без переноса значений человек терял бы всё
 * набранное — а в живом виде конструктора схему правят непрерывно. Место значений здесь по той
 * же причине, что и у всего остального в этом модуле: поверхность размонтируется при каждом
 * переключении вида, и состояние, живущее в ней, исчезло бы вместе с ней.
 *
 * Но в {@link PreviewState} их нет, и это не оплошность. Снимок — то, на что ПОДПИСАНЫ; значения
 * читает только сборка формы, и никто их не показывает. Положи их в снимок — и запись значений
 * при размонтировании перерисовывала бы панель, ничего не меняя на экране.
 *
 * От мок-данных они отличаются происхождением, а не только местом: мок пишет автор, и он
 * переживает закрытие вкладки; эти значения человек набрал, чтобы посмотреть на форму, и дальше
 * сеанса им жить незачем.
 *
 * ## Чего здесь нет
 *
 * Мок-данных. По контракту они живут в OPFS рядом с рабочей копией как авторский артефакт,
 * а не в памяти панели: их можно выгрузить в файл и положить в проект. Хранилища под них
 * плагину сегодня никто не даёт (см. шапку `./index`), поэтому поле в состоянии не заводится —
 * пустое место честнее места, которое незаметно потеряет содержимое при закрытии вкладки.
 *
 * @module plugins/preview/state/store
 */

import type { Disposable, NodeId } from '@/sdk';
import type { PreviewProblem, PreviewValues } from '../contract';

/** Снимок состояния превью одного документа. */
export interface PreviewState {
  readonly selection: readonly NodeId[];
  /** Находки всех источников, слитые в один список в порядке источников. */
  readonly problems: readonly PreviewProblem[];
  /**
   * Живая форма последней сборки либо `null`, если её сейчас нет.
   *
   * В снимке — в отличие от введённых значений, — потому что на неё ПОДПИСАНЫ: панель модели
   * перерисовывается, когда форма пересобралась. Хранится ссылка на объект, а не его содержимое:
   * значения внутри живут на сигналах и меняются, не трогая снимок, — иначе каждое нажатие
   * клавиши в форме перерисовывало бы всё, что подписано на состояние превью.
   */
  readonly form: PreviewForm | null;
}

/**
 * Собранная форма в объёме, которым пользуется наблюдатель.
 *
 * Структурная копия `JsonForm` — ровно те три вещи, ради которых форму и публикуют: значения,
 * реестр (опции для редакторов) и узлы, добываемые из модели через `signalAt` + `getNodeForSignal`.
 * Шире брать нечего: `store` не рисует форму и не пересобирает её.
 */
export interface PreviewForm {
  readonly model: unknown;
  readonly registry?: unknown;
}

export interface PreviewStore {
  get(): PreviewState;
  subscribe(cb: () => void): Disposable;
  select(ids: readonly NodeId[]): void;
  report(source: string, problems: readonly PreviewProblem[]): void;
  /**
   * Каждая публикация находок — и та, что ничего не изменила.
   *
   * `subscribe` молчит о повторе того же состава (иначе панель перерисовывалась бы на каждую
   * пересборку), а своду диагностик нужен именно факт пересборки: снятая при правке файла
   * находка обязана вернуться, даже если сборка нашла ровно то же самое.
   */
  onDidReport(cb: () => void): Disposable;
  /** Значения прежней формы; пусто, пока в форму ничего не вводили. */
  values(): PreviewValues | undefined;
  /** Запомнить значения формы — перед пересборкой и при размонтировании поверхности. */
  keepValues(values: PreviewValues): void;
  /**
   * Отдать живую форму наблюдателям; `null` — формы сейчас нет.
   *
   * Отдельно от {@link PreviewStore.keepValues}: тот про СНИМОК для переноса между сборками,
   * этот про живой объект для наблюдения и правки. Под одним именем хранилище отдавало бы
   * то устаревший снимок, то текущую модель.
   */
  publishForm(form: PreviewForm | null): void;
}

const NO_PROBLEMS: readonly PreviewProblem[] = Object.freeze([]);
const NO_SELECTION: readonly NodeId[] = Object.freeze([]);

export function createPreviewStore(): PreviewStore {
  const bySource = new Map<string, readonly PreviewProblem[]>();
  /** Вне снимка намеренно — см. шапку модуля. */
  let values: PreviewValues | undefined;
  const listeners = new Set<() => void>();
  const reporters = new Set<() => void>();

  let state: PreviewState = Object.freeze({
    selection: NO_SELECTION,
    problems: NO_PROBLEMS,
    form: null,
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

    select(ids) {
      if (sameIds(ids, state.selection)) return;
      commit({ ...state, selection: Object.freeze([...ids]) });
    },

    values: () => values,

    keepValues(next) {
      values = next;
    },

    publishForm(form) {
      // Сравнение по ссылке: пересборка даёт НОВЫЙ объект формы, а повторная публикация
      // той же — обычное дело при перемонтировании поверхности, и перерисовывать по ней нечего.
      if (state.form === form) return;
      commit({ ...state, form });
    },

    onDidReport(cb) {
      reporters.add(cb);
      return {
        dispose(): void {
          reporters.delete(cb);
        },
      };
    },

    report(source, problems) {
      try {
        const previous = bySource.get(source);
        const unchanged =
          previous === undefined ? problems.length === 0 : sameProblems(previous, problems);
        if (unchanged) return;
        // Пустой список — это «у меня чисто», и он обязан СНИМАТЬ прошлые находки источника,
        // а не оставлять его запись пустой: иначе порядок слияния зависел бы от истории.
        if (problems.length === 0) bySource.delete(source);
        else bySource.set(source, Object.freeze([...problems]));
        commit({ ...state, problems: mergeProblems(bySource) });
      } finally {
        // Факт публикации — всегда, и после раннего выхода тоже: см. `onDidReport`.
        for (const reporter of [...reporters]) {
          try {
            reporter();
          } catch (error) {
            console.error('[preview] подписчик публикаций упал', error);
          }
        }
      }
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
