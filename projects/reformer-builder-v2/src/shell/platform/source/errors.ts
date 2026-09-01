/**
 * Отказы источника — типизированные, потому что вызывающий обязан их различать.
 *
 * «Нет файла» и «нет сети» — противоположные указания: первое означает «материализовать
 * нечего, идём дальше», второе — «остановись и скажи». Склеивание их в один `catch` — ровно
 * та ошибка, из-за которой пустая рабочая область выглядит как пустой проект.
 *
 * **Распознавание структурное, а не через `instanceof`.** Это не вкусовщина: Workspace
 * написан раньше источника и уже проверяет отказ по полю `kind`
 * (`host/workspace/source.ts`, `isSourceError`). Привязка к классу означала бы, что чужой
 * источник — реализованный плагином, приехавший из другого бандла или подставленный в тесте —
 * перестаёт распознаваться, хотя отвечает по контракту. Поэтому здесь класс {@link SourceError}
 * есть, но он лишь УДОБНЫЙ способ выдать нужную форму, а не условие её признания.
 *
 * Сообщение — человеку, {@link SourceErrorKind} — коду. Локализованных строк в отказах быть
 * не должно (решение 6 плана: ошибки несут код и параметры); текущие сообщения — отладочные,
 * и перевод их в коды с параметрами идёт отдельной работой вместе с диагностиками валидаторов.
 *
 * @module shell/platform/source/errors
 */

import { normalizePath } from '@/shell/platform/primitives/resource';

/** Виды отказов. Набор совпадает с `SourceErrorKind` Workspace — это один и тот же набор. */
export type SourceErrorKind =
  /** Ресурса или каталога нет. Для `list` — именно отказ, а не пустой список. */
  | 'not-found'
  /** Ревизия разошлась. Обязан нести {@link SourceErrorLike.revision} — текущую у источника. */
  | 'conflict'
  /** Не вошли: нужен токен, разрешение не запрашивали или его отозвали. */
  | 'unauthorized'
  /** Вошли, но нельзя: путь за пределами корня, каталог только на чтение. */
  | 'forbidden'
  /** Возможности нет вовсе. То же самое, что отсутствие необязательного метода. */
  | 'unsupported'
  /** Превышен потолок листинга. Усечь молча нельзя — см. `SOURCE_LIST_LIMIT`. */
  | 'budget'
  /** Транспорт не справился. Для локальной ФС — любой неопознанный сбой ввода-вывода. */
  | 'network'
  /** Операцию отменили: закрыли диалог, ушли со страницы, сработал `AbortSignal`. */
  | 'aborted';

/**
 * Форма отказа, на которую смотрят вызывающие.
 *
 * Ровно то, что проверяет Workspace. Реализация источника не обязана наследовать
 * {@link SourceError} — обязана выдать объект-ошибку этой формы.
 */
export interface SourceErrorLike extends Error {
  readonly kind: SourceErrorKind;
  readonly path?: string;
  /** Для `conflict` — ревизия, которая сейчас у источника, то есть та, с которой разошлись. */
  readonly revision?: string;
}

const SOURCE_ERROR_KINDS: ReadonlySet<string> = new Set<SourceErrorKind>([
  'not-found',
  'conflict',
  'unauthorized',
  'forbidden',
  'unsupported',
  'budget',
  'network',
  'aborted',
]);

/** Отказ источника. Наследовать необязательно; удобно — обязательно только совпадение формы. */
export class SourceError extends Error implements SourceErrorLike {
  readonly kind: SourceErrorKind;
  readonly path?: string;
  readonly revision?: string;

  constructor(
    kind: SourceErrorKind,
    message: string,
    options?: { path?: string; revision?: string; cause?: unknown }
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'SourceError';
    this.kind = kind;
    this.path = options?.path;
    this.revision = options?.revision;
  }
}

/**
 * Отказ ли это источника (и того ли вида).
 *
 * Алгоритм намеренно повторяет `isSourceError` Workspace: объект-ошибка со строковым `kind`
 * из известного набора. Разойтись этим двум проверкам нельзя — тогда один и тот же отказ
 * распознавался бы по-разному на разных этажах, и это самая тихая из возможных поломок.
 */
export function isSourceError(err: unknown, kind?: SourceErrorKind): err is SourceErrorLike {
  if (!(err instanceof Error)) return false;
  const actual = (err as Error & { kind?: unknown }).kind;
  if (typeof actual !== 'string' || !SOURCE_ERROR_KINDS.has(actual)) return false;
  return kind === undefined || actual === kind;
}

/** Ревизия из отказа-конфликта, если источник её сообщил. */
export function conflictRevision(err: unknown): string | undefined {
  if (!isSourceError(err, 'conflict')) return undefined;
  return err.revision;
}

/**
 * Нормализует путь по правилам ядра, превращая побег за корень в ТИПИЗИРОВАННЫЙ отказ.
 *
 * Живёт здесь, а не в адаптерах, по двум причинам сразу. Первая: нормализация одна на всех
 * (ею владеет `primitives/resource`), и адаптер, сделавший её по-своему, разойдётся с ядром.
 * Вторая: `normalizePath` бросает обычный `Error`, а метод источника обязан отказывать
 * типизированно — иначе `fs:../../etc/hosts` прилетит вызывающему как неведомая авария
 * вместо внятного `forbidden`, и обработчик отказов его не увидит.
 */
export function sourcePath(path: string): string {
  try {
    return normalizePath(path);
  } catch (cause) {
    throw new SourceError('forbidden', `путь выходит за корень источника: ${path}`, {
      path,
      cause,
    });
  }
}

/**
 * Отказ «не умею».
 *
 * Нужен там, где метод объявлен, но операция недоступна по состоянию (не по адаптеру):
 * каталог смонтирован только на чтение, у ключа нет права на запись. Источник, не умеющий
 * операцию в принципе, метод не объявляет — для вызывающего это тот же ответ.
 */
export function unsupported(operation: string, path?: string): SourceError {
  return new SourceError('unsupported', `источник не поддерживает ${operation}`, { path });
}
