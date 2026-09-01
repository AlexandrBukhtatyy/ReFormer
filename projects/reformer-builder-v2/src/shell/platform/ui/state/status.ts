/**
 * Состояние рабочей области в том виде, в каком его показывает строка состояния.
 *
 * Строка состояния небольшая, но это **единственное место, где видно состояние рабочей
 * области**: несохранённые изменения, «изменён снаружи», активная локаль. Без неё расхождение
 * с источником обнаруживается только в момент сохранения — то есть тогда, когда исправлять
 * его уже дорого.
 *
 * ## Почему источник — порт, а не сам Workspace
 *
 * Здесь объявлен {@link WorkspaceStatusSource} — три метода и снимок, — а не импорт рабочей
 * области. Причина не в развязке ради развязки: `Workspace` отвечает на вопросы про отдельный
 * ресурс (`isDirty(id)`), а строке состояния нужен **итог по всем открытым**, и вычислять его
 * перебором на каждую перерисовку означало бы ходить по всем документам при каждом движении
 * фокуса. Кто считает итог — решает композиция; здесь известно только, что итог кто-то даёт
 * и уведомляет о его смене.
 *
 * Побочное следствие, ради которого это тем более стоит: оболочка рисуется до того, как
 * рабочая область восстановлена (шаг 6 стоит до шага 7 в последовательности запуска), и
 * состояние «источник ещё не открыт» обязано быть выразимым, а не быть нулями.
 *
 * ## Что здесь и чего здесь нет
 *
 * Есть: правило «что показывать при таком состоянии». Нет: React, DOM, i18n. Индикатор несёт
 * ключ сообщения и параметры, а не текст, — перевод случается в отрисовке, потому что локаль
 * меняется, а правило нет.
 *
 * @module host/ui/status
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';

/** Итог по рабочей области. Числа, а не списки: строке состояния нужен счёт, а не адреса. */
export interface WorkspaceStatusSnapshot {
  /**
   * Открыта ли рабочая область вообще.
   *
   * Отдельное поле, а не «ноль открытых»: «источник не выбран» и «в источнике всё сохранено» —
   * разные состояния, и показывать «всё сохранено» до открытия проекта значит утверждать
   * то, чего никто не проверял.
   */
  readonly hasWorkspace: boolean;
  /** Сколько ресурсов имеют несохранённые правки. */
  readonly dirtyCount: number;
  /** Сколько ресурсов изменились в источнике после того, как были прочитаны. */
  readonly externallyChangedCount: number;
}

/** Состояние до открытия рабочей области. Заморожено — им можно делиться. */
export const NO_WORKSPACE_STATUS: WorkspaceStatusSnapshot = Object.freeze({
  hasWorkspace: false,
  dirtyCount: 0,
  externallyChangedCount: 0,
});

/**
 * Источник итога.
 *
 * Форма та же, что у хранилища контекста применимости, и по той же причине: снимок читают
 * и компоненты через `useSyncExternalStore` (которому нужна стабильная ссылка), и код вне
 * React. `get()` обязан возвращать **ту же** ссылку, пока ничего не изменилось.
 */
export interface WorkspaceStatusSource {
  get(): WorkspaceStatusSnapshot;
  subscribe(listener: () => void): Disposable;
}

/**
 * Источник, который всегда отвечает одним и тем же.
 *
 * Нужен там, где рабочей области ещё нет: оболочка отрисовывается до её восстановления,
 * и «источника нет» обязано быть нормальным состоянием, а не отсутствием строки состояния.
 * Подписка настоящая, но никогда не срабатывает, — это честнее, чем `undefined`, потому что
 * потребителю не приходится знать, бывает ли источник.
 */
export function createStaticWorkspaceStatusSource(
  snapshot: WorkspaceStatusSnapshot = NO_WORKSPACE_STATUS
): WorkspaceStatusSource {
  const frozen = Object.freeze({ ...snapshot });
  return {
    get: (): WorkspaceStatusSnapshot => frozen,
    subscribe: (): Disposable => toDisposable(() => undefined),
  };
}

/** Насколько состояние требует внимания. Значения те же, что у декораций ресурсов. */
export type StatusTone = 'default' | 'accent' | 'warning' | 'danger';

/** Одна ячейка строки состояния. Ключ и параметры, а не текст: локаль меняется, правило нет. */
export interface StatusIndicator {
  readonly id: string;
  readonly messageKey: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly tone: StatusTone;
}

/**
 * Приводит счётчик к неотрицательному целому.
 *
 * Итог приходит извне, и «−1» или `NaN` там означают ошибку у поставщика, а не состояние
 * рабочей области. Показывать «−1 несохранённый файл» нельзя: это выглядит как поломка
 * рабочей области, а поломан подсчёт.
 */
function count(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/**
 * Что показать при таком состоянии рабочей области.
 *
 * Порядок несущий: «изменён снаружи» идёт перед «несохранённые изменения», потому что
 * сообщает о том, что сохранение **сейчас не пройдёт**, а несохранённые правки — о том, что
 * оно ещё не запускалось. Оба состояния сосуществуют, и показывать одно вместо другого
 * значило бы скрыть конфликт до момента сохранения — ровно то, ради чего строка и заведена.
 */
export function describeWorkspaceStatus(
  snapshot: WorkspaceStatusSnapshot
): readonly StatusIndicator[] {
  if (!snapshot.hasWorkspace) {
    return [{ id: 'workspace.none', messageKey: 'shell.status.workspace.none', tone: 'default' }];
  }

  const external = count(snapshot.externallyChangedCount);
  const dirty = count(snapshot.dirtyCount);
  const indicators: StatusIndicator[] = [];

  if (external > 0) {
    indicators.push({
      id: 'workspace.external',
      messageKey: 'shell.status.workspace.external',
      params: { count: external },
      tone: 'danger',
    });
  }
  if (dirty > 0) {
    indicators.push({
      id: 'workspace.dirty',
      messageKey: 'shell.status.workspace.dirty',
      params: { count: dirty },
      tone: 'warning',
    });
  }
  if (indicators.length === 0) {
    indicators.push({
      id: 'workspace.saved',
      messageKey: 'shell.status.workspace.saved',
      tone: 'default',
    });
  }
  return indicators;
}

/**
 * Индикатор активной локали.
 *
 * Отдельной функцией, а не полем снимка: локаль принадлежит сервису i18n, а не рабочей
 * области, и класть её в снимок значило бы обновлять состояние рабочей области при смене
 * языка.
 */
export function localeIndicator(locale: string): StatusIndicator {
  return {
    id: 'locale',
    messageKey: 'shell.status.locale',
    params: { locale: locale.toUpperCase() },
    tone: 'default',
  };
}

/**
 * Ожидание второй ступени аккорда. `null` — ожидания нет, и ячейки в строке не существует.
 *
 * Ячейка появляется только на время ожидания, а не висит пустой: строка состояния узкая,
 * и место в ней принадлежит тому, что происходит сейчас. Показать здесь обязательно —
 * иначе состояние «приложение ждёт вторую клавишу» ничем не отличается от зависшего.
 *
 * Отдельной функцией, а не полем снимка, по той же причине, что и локаль: аккорд принадлежит
 * клавиатуре, а не рабочей области.
 */
export function chordIndicator(labels: readonly string[]): StatusIndicator | null {
  if (labels.length === 0) return null;
  return {
    id: 'chord',
    messageKey: 'shell.status.chord',
    params: { keys: labels.join(' ') },
    tone: 'accent',
  };
}
