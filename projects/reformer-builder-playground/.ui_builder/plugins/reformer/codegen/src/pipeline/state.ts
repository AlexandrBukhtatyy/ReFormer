/**
 * Состояние генерации по документам: что напечатали, что записали, чем всё кончилось.
 *
 * Почему состояние, а не локальный `useState` панели: генерацию запускает и команда палитры,
 * а результат обязан быть виден там же, где его смотрит человек. Локальный стейт означал бы,
 * что запуск из палитры не показывает ничего.
 *
 * Один срез на документ — как у сеансов превью, и по той же причине: закрыли вкладку, открыли
 * другую и вернулись — отчёт о прошлой генерации не должен превратиться в отчёт о чужой форме.
 *
 * @module plugins/reformer/codegen/pipeline/state
 */

import type {
  CodegenFileClass,
  CodegenProblem,
  CodegenTargetOrigin,
  Disposable,
  ResourceId,
} from '@reformer/builder-plugin-api';
import type { DeliveryResult } from './deliver';

/** Фаза работы. `idle` — ещё не запускали или уже показали результат. */
export type CodegenPhase = 'idle' | 'running';

/** Файл в отчёте: чем он является и КТО его напечатал. */
export interface ReportedFile {
  readonly path: string;
  readonly cls: CodegenFileClass;
  /** Цель-печатник: по нему панель предлагает выгрузить её шаблон. */
  readonly targetId: string;
  readonly origin: CodegenTargetOrigin;
}

/**
 * Отказ, из-за которого прогон не состоялся.
 *
 * Ключ словаря ХОЗЯИНА (документ закрыли, источник не принимает запись) либо СТЕКА (файлы шагов
 * не собираются, кит модуля не тот): стек говорит своими словами, и панель переводит его ключ
 * его же словарём.
 */
export interface CodegenError {
  readonly key: string;
  /** Подстановки в текст отказа: `error.kit-mismatch` называет кит модуля и активный. */
  readonly params?: Readonly<Record<string, string | number>>;
  /** Подробность, которую ключ словаря не передаёт (какой файл шага не собрался). */
  readonly detail?: string;
  /** Стек, чей это ключ. Нет — ключ словаря хозяина. */
  readonly stack?: string;
}

export interface CodegenState {
  readonly phase: CodegenPhase;
  /** Имя формы: предзаполняется из имени файла схемы, дальше правится человеком. */
  readonly formName: string;
  /** Файлы последнего прогона — то, что было бы записано. */
  readonly files: readonly ReportedFile[];
  /** Сниппет регистрации формы. Пустой — прогона ещё не было. */
  readonly snippet: string;
  readonly problems: readonly CodegenProblem[];
  readonly delivery: DeliveryResult | null;
  readonly error: CodegenError | null;
  /** Стек, который печатал последний прогон: его словарём переводятся заметки записи. */
  readonly stack: string | null;
  /** Корень модуля путём от корня проекта — для отчёта заказчику генерации. */
  readonly rootPath: string | null;
  /**
   * Данные, которые видели шаблоны (`it`). `null` — прогона ещё не было.
   *
   * Нужны инспектору: автор шаблона обязан видеть, чем располагает, не читая исходники.
   */
  readonly view: object | null;
}

const INITIAL: CodegenState = Object.freeze({
  phase: 'idle',
  formName: '',
  files: [],
  snippet: '',
  problems: [],
  delivery: null,
  error: null,
  stack: null,
  rootPath: null,
  view: null,
});

export interface CodegenStore {
  get(): CodegenState;
  patch(next: Partial<CodegenState>): void;
  subscribe(cb: () => void): Disposable;
}

function createStore(): CodegenStore {
  let state = INITIAL;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    patch(next) {
      state = { ...state, ...next };
      for (const listener of [...listeners]) listener();
    },
    subscribe(cb) {
      listeners.add(cb);
      return {
        dispose: () => {
          listeners.delete(cb);
        },
      };
    },
  };
}

/** Реестр срезов по документам. */
export interface CodegenSessions {
  storeFor(id: ResourceId): CodegenStore;
  /** На что смотрит панель — команде это нужно, а своего способа узнать у неё нет. */
  active(): ResourceId | null;
  setActive(id: ResourceId | null): void;
  dispose(): void;
}

export function createCodegenSessions(): CodegenSessions {
  const stores = new Map<ResourceId, CodegenStore>();
  let active: ResourceId | null = null;
  return {
    storeFor(id) {
      const existing = stores.get(id);
      if (existing !== undefined) return existing;
      const created = createStore();
      stores.set(id, created);
      return created;
    },
    active: () => active,
    setActive(id) {
      active = id;
    },
    dispose() {
      stores.clear();
      active = null;
    },
  };
}
