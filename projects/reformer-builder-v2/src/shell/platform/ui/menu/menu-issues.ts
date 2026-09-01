/**
 * Отчёт о записях меню, которые не попали на экран.
 *
 * ## Почему отложенно, а не сразу
 *
 * Набор команд складывается ПОСЛЕ первого кадра: палитра и справка регистрируют свои
 * в эффектах, плагины — при активации. Меню строится раньше, поэтому «команды нет» на первом
 * кадре означает не поломку, а порядок запуска. Прямое сообщение давало ровно это: девять
 * ошибок в консоли при каждом запуске, все ложные (проверено запуском — они и заставили
 * завести модуль).
 *
 * Поэтому промахи копятся и печатаются один раз в конце текущей задачи, и перед печатью
 * КАЖДЫЙ перепроверяется: команда, появившаяся за это время, из отчёта исчезает. Остаётся
 * ровно то, ради чего отчёт нужен, — опечатка в идентификаторе и вклад выключенного плагина.
 *
 * ## Почему не «просто убрать сообщение»
 *
 * Пункт, за которым нет команды, не рисуется. Молча — значит «я внёс пункт, а его нет», и
 * виновника ищут чтением всех плагинов сразу. Диагностика здесь дешевле любого поиска.
 *
 * @module shell/platform/ui/menu/menu-issues
 */

import type { MenuIssue } from './menu';

/** Ключ промаха: одна пара «запись → цель» сообщается однажды, сколько бы кадров ни прошло. */
function issueKey(issue: MenuIssue): string {
  return `${issue.kind}:${issue.entryId}:${issue.target ?? ''}`;
}

export interface MenuIssueReporterOptions {
  /**
   * Есть ли команда сейчас. Только для `unknown-command`: остальные промахи (цикл, глубина,
   * занятый корень) от времени не зависят и перепроверять их не в чем.
   */
  readonly hasCommand: (commandId: string) => boolean;
  /** Куда печатать. Отдельным входом, чтобы тест не читал консоль. */
  readonly log: (issue: MenuIssue) => void;
  /**
   * Чем откладывать. `setTimeout(…, 0)` по умолчанию: он выполняется после эффектов
   * монтирования всего дерева, то есть после того, как команды успели зарегистрироваться.
   */
  readonly schedule?: (flush: () => void) => void;
}

/** Отчётчик: собирает промахи и печатает их отложенно. */
export interface MenuIssueReporter {
  (issue: MenuIssue): void;
}

export function createMenuIssueReporter(options: MenuIssueReporterOptions): MenuIssueReporter {
  const schedule = options.schedule ?? ((flush: () => void) => setTimeout(flush, 0));
  const reported = new Set<string>();
  const pending = new Map<string, MenuIssue>();
  let scheduled = false;

  const flush = (): void => {
    scheduled = false;
    for (const [key, issue] of pending) {
      // Команда появилась, пока сообщение ждало очереди, — промаха не было.
      if (issue.kind === 'unknown-command' && issue.target !== undefined) {
        if (options.hasCommand(issue.target)) continue;
      }
      if (reported.has(key)) continue;
      reported.add(key);
      options.log(issue);
    }
    pending.clear();
  };

  return (issue: MenuIssue): void => {
    const key = issueKey(issue);
    if (reported.has(key)) return;
    pending.set(key, issue);
    if (scheduled) return;
    scheduled = true;
    schedule(flush);
  };
}

/** Как промах выглядит в консоли. Отдельно — чтобы тест проверял отбор, а не текст. */
export function formatMenuIssue(issue: MenuIssue): string {
  const owner = issue.pluginId === undefined ? 'оболочки' : `плагина «${issue.pluginId}»`;
  const target = issue.target === undefined ? '' : ` → «${issue.target}»`;
  return `[shell] запись меню «${issue.entryId}» ${owner} не показана: ${issue.kind}${target}`;
}
