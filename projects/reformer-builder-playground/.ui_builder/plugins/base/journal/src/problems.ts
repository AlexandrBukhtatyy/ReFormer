/**
 * Вид «Проблемы» журнала — чистая часть, без React и без реестров.
 *
 * Свод диагностик — плоский список находок по одному ресурсу. Журналу нужен **сгруппированный
 * список** и общий счёт для значка на вкладке. Оба — правила, а не отрисовка: «в каком порядке
 * идут строки» обязано иметь ответ, который можно проверить, а не посмотреть глазами.
 *
 * Свод одного ресурса (худшая строгость и счётчики) считает SDK (`summarizeDiagnostics`):
 * тот же свод нужен пометке файла в дереве, а это другой плагин.
 *
 * @module plugins/base/journal/problems
 */

import { SEVERITY_RANK, summarizeDiagnostics, usableFixes } from '@reformer/builder-plugin-api';
import type {
  CommandLookup,
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTarget,
  DiagnosticsSummary,
  QuickFix,
  ResourceId,
  SeverityCounts,
} from '@reformer/builder-plugin-api';

/**
 * Реестр команд в объёме, нужном быстрым исправлениям.
 *
 * Не порт композиции: реестр приходит плагину в `activate` (`ctx.commands`). Тип живёт
 * в чистом модуле, а не рядом с плагином, чтобы панель не импортировала `./plugin`, который
 * импортирует её саму.
 */
export interface CommandAccess {
  /** Есть ли сейчас такая команда — тот же вопрос, что задаёт `usableFixes`. */
  has(commandId: string): boolean;
  /** Запустить с аргументами исправления. Отказ уходит в журнал, а не наверх. */
  run(commandId: string, args?: unknown): void;
}

const NO_COUNTS: SeverityCounts = Object.freeze({ error: 0, warning: 0, info: 0 });

/** Складывает своды нескольких ресурсов — для значка и счётчика переключателя. */
export function totalCounts(summaries: readonly (DiagnosticsSummary | null)[]): SeverityCounts {
  let error = 0;
  let warning = 0;
  let info = 0;
  for (const summary of summaries) {
    if (summary === null) continue;
    error += summary.counts.error;
    warning += summary.counts.warning;
    info += summary.counts.info;
  }
  return error + warning + info === 0 ? NO_COUNTS : { error, warning, info };
}

/** Одна строка вида «Проблемы». */
export interface ProblemRow {
  /** React-ключ: адрес ресурса плюс место находки в его своде. Устойчив между перерисовками. */
  readonly key: string;
  readonly resource: ResourceId;
  readonly severity: DiagnosticSeverity;
  /** Голый код, без приставки `errors.` — её ставит тот, кто переводит. */
  readonly code: string;
  readonly params?: Record<string, unknown>;
  /** Идентификатор валидатора: по нему видно, кто это нашёл. */
  readonly source: string;
  readonly target: DiagnosticTarget;
  /**
   * Исправления, которым есть чем исполниться прямо сейчас.
   *
   * Отбор идёт ЗДЕСЬ, при сборке списка, а не при публикации находки — точнее, ВТОРОЙ раз
   * после неё: список пересобирается на каждой отрисовке, и между публикацией и нажатием
   * плагин, владеющий командой, могли выключить. Кнопка, отказывающая при нажатии, хуже
   * её отсутствия.
   */
  readonly fixes: readonly QuickFix[];
}

/** Находки одного ресурса. */
export interface ProblemGroup {
  readonly resource: ResourceId;
  /** Имя для человека: последний сегмент пути, если ресурс удалось назвать; иначе сам адрес. */
  readonly name: string;
  /** Путь для подсказки, если он известен. */
  readonly path: string | null;
  readonly summary: DiagnosticsSummary;
  readonly rows: readonly ProblemRow[];
}

/** Как вид узнаёт имя ресурса. `null` — назвать нечем. */
export type ResourceNaming = (id: ResourceId) => { name: string; path: string } | null;

/**
 * Умолчание отбора исправлений: команд нет ни одной.
 *
 * Отказ, а не пропуск: не назвавший реестра вызывающий сверить исправления не может,
 * а показать их как есть значило бы вернуть ровно ту кнопку-обманку, ради которой отбор
 * и заведён. Список при этом собирается как прежде — исчезают только кнопки.
 */
const NOTHING_REGISTERED: CommandLookup = () => false;

/**
 * Собирает список вида «Проблемы».
 *
 * Порядок ресурсов приходит извне готовым (служба отдаёт состав отсортированным) и здесь
 * не трогается: пересортировать его по имени значило бы, что два файла с одинаковыми
 * именами в разных каталогах меняются местами при каждом изменении свода.
 *
 * Порядок строк внутри ресурса — по строгости, сначала ошибки. Сортировка **устойчивая**,
 * поэтому внутри одной строгости сохраняется порядок свода (источники по алфавиту, внутри
 * источника — порядок публикации), и строка, на которую человек смотрит, не перескакивает
 * от того, что валидатор сходил заново.
 *
 * Ресурсы без находок отбрасываются: состав службы их не содержит, но вызывающий вправе
 * передать любой список — например все открытые вкладки.
 */
export function groupProblems(
  resources: readonly ResourceId[],
  read: (id: ResourceId) => readonly Diagnostic[],
  naming: ResourceNaming,
  isRegistered: CommandLookup = NOTHING_REGISTERED
): readonly ProblemGroup[] {
  const groups: ProblemGroup[] = [];
  for (const resource of resources) {
    const items = read(resource);
    const summary = summarizeDiagnostics(items);
    if (summary === null) continue;
    const named = naming(resource);
    const rows = items
      .map(
        (item, index): ProblemRow => ({
          key: `${resource}#${index}`,
          resource,
          severity: item.severity,
          code: item.code,
          params: item.params,
          source: item.source,
          target: item.target,
          fixes: usableFixes(item, isRegistered),
        })
      )
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
    groups.push({
      resource,
      name: named?.name ?? resource,
      path: named?.path ?? null,
      summary,
      rows,
    });
  }
  return groups;
}
