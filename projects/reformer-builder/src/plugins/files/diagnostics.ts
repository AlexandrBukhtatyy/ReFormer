/**
 * Диагностика для дерева и для панели проблем — чистая часть, без React и без реестров.
 *
 * Свод диагностик — плоский список находок по одному ресурсу. Тому, кто рисует, нужны две
 * другие формы: **одна пометка на файл** (значок в дереве) и **сгруппированный список**
 * (панель проблем). Обе — правила, а не отрисовка: «какой тон у файла, где есть и ошибка,
 * и предупреждение» и «в каком порядке идут строки» обязаны иметь ответ, который можно
 * проверить, а не посмотреть глазами. Окружение тестов — `node`, поэтому граница проведена
 * ровно здесь.
 *
 * ## Строгость побеждает: тон файла — по худшей находке
 *
 * То же правило, что у слияния декораций в Host (`TONE_SEVERITY`), и по той же причине:
 * пометка — сигнал, а не оформление. Файл с одной ошибкой и десятью предупреждениями
 * обязан выглядеть как файл с ошибкой.
 *
 * ## Счётчик считает ВСЁ, а не только ошибки
 *
 * Значок «3» на файле с тремя предупреждениями честнее, чем «0»: предупреждение — это тоже
 * то, что человек собирался увидеть в списке. Разделение по строгости несёт тон, а не число.
 *
 * @module plugins/files/diagnostics
 */

import { SEVERITY_RANK, usableFixes } from '@/sdk';
import type {
  CommandLookup,
  Decoration,
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTarget,
  QuickFix,
  ResourceId,
} from '@/sdk';

/**
 * Реестр команд в объёме, нужном панели проблем.
 *
 * Не порт композиции: реестр приходит плагину в `activate` (`ctx.commands`). Тип живёт
 * в чистом модуле, а не рядом с плагином, чтобы панель не импортировала `./plugin`, который
 * импортирует её саму.
 */
export interface CommandAccess {
  /** Есть ли сейчас такая команда — тот же вопрос, что задаёт `usableFixes`. */
  has(commandId: string): boolean;
  /** Запустить с аргументами исправления. Отказ реестра уходит в консоль, а не наверх. */
  run(commandId: string, args?: unknown): void;
}

/** Строгость → тон пометки. Тон объявлен Host, здесь только соответствие. */
export const SEVERITY_TONE = Object.freeze({
  error: 'danger',
  warning: 'warning',
  info: 'default',
} as const) satisfies Record<DiagnosticSeverity, NonNullable<Decoration['tone']>>;

/**
 * Старшинство строгости. Больше — строже.
 *
 * Своя таблица, а не заимствованная из Host: `plugins
/** Сколько находок каждой строгости. */
export interface SeverityCounts {
  readonly error: number;
  readonly warning: number;
  readonly info: number;
}

/** Свод ресурса, сжатый до того, что рисуется. */
export interface DiagnosticsSummary {
  /** Самая строгая находка ресурса — она и задаёт тон. */
  readonly worst: DiagnosticSeverity;
  readonly counts: SeverityCounts;
  /** Всего находок; совпадает с длиной свода. */
  readonly total: number;
}

const NO_COUNTS: SeverityCounts = Object.freeze({ error: 0, warning: 0, info: 0 });

/** Сжимает свод ресурса. `null` — находок нет, и это не то же самое, что «ноль ошибок». */
export function summarize(items: readonly Diagnostic[]): DiagnosticsSummary | null {
  if (items.length === 0) return null;
  let error = 0;
  let warning = 0;
  let info = 0;
  let worst: DiagnosticSeverity = 'info';
  for (const item of items) {
    if (item.severity === 'error') error += 1;
    else if (item.severity === 'warning') warning += 1;
    else info += 1;
    if (SEVERITY_RANK[item.severity] > SEVERITY_RANK[worst]) worst = item.severity;
  }
  return { worst, counts: { error, warning, info }, total: items.length };
}

/** Складывает своды нескольких ресурсов — для заголовка панели. */
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

/**
 * Пометка файла по его своду. `null` — вкладу нечего сказать про этот ресурс.
 *
 * Ключ подсказки — в пространстве имён ЭТОГО плагина: `tooltipKey` разрешается словарём
 * внёсшего (то же правило, что у заголовка панели). Счётчик уходит параметром, а не
 * вклеивается в строку: иначе перевод случался бы здесь, а не в момент показа, и смена
 * локали оставила бы на экране прежний язык.
 */
export function diagnosticDecoration(items: readonly Diagnostic[]): Decoration | null {
  const summary = summarize(items);
  if (summary === null) return null;
  return {
    badge: String(summary.total),
    tone: SEVERITY_TONE[summary.worst],
    tooltipKey: `tree.problems.${summary.worst}`,
    tooltipParams: { count: summary.total },
  };
}

/** Одна строка панели проблем. */
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
   * после неё: список пересобирается на каждой отрисовке панели, и между публикацией
   * и нажатием плагин, владеющий командой, могли выключить. Кнопка, отказывающая при
   * нажатии, хуже её отсутствия.
   */
  readonly fixes: readonly QuickFix[];
}

/** Находки одного ресурса. */
export interface ProblemGroup {
  readonly resource: ResourceId;
  /** Имя для человека: последний сегмент пути, если ресурс открыт; иначе сам адрес. */
  readonly name: string;
  /** Путь для подсказки, если он известен. */
  readonly path: string | null;
  readonly summary: DiagnosticsSummary;
  readonly rows: readonly ProblemRow[];
}

/** Как панель узнаёт имя ресурса. `null` — документ закрыт, и спросить не у кого. */
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
 * Собирает список панели проблем.
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
    const summary = summarize(items);
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
