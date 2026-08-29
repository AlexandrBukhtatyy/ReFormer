/**
 * Минимальный контракт источника — ровно то, что у него просит Workspace.
 *
 * **Почему он объявлен здесь, а не взят из Э3.** Настоящий `Source` (Э3) ещё не написан,
 * а Workspace без источника не проверяем вовсе. Объявить здесь потребность — дешевле, чем
 * ждать: получившийся интерфейс является входом для Э3, и совместить их можно с любой
 * стороны, потому что зависимость структурная. Полный `Source` (`capabilities`, `descriptor`,
 * `mkdir`/`remove`/`move`, `listForms`, `watch`) — надмножество: он подойдёт сюда как есть.
 *
 * **Что здесь намеренно НЕ описано.** Возможности (`capabilities`): Workspace спрашивает
 * не «умеешь ли ты писать», а «напиши» — и получает отказ, если не умеет. Проверка
 * возможности перед вызовом породила бы два источника правды об одном и том же, и они
 * разъехались бы на первом источнике, где право на запись зависит от пути, а не от адаптера.
 * Отсутствие необязательного метода — тот же самый ответ, только не требующий поля.
 *
 * **Отказы распознаются структурно.** `SourceError` — класс из Э3, и `instanceof` привязал бы
 * Workspace к его реализации ещё до того, как она написана. Поэтому распознаётся форма:
 * объект-ошибка с полем `kind` из известного набора ({@link isSourceError}). Различать отказы
 * обязательно: «нет файла» — это «материализовать нечего, идём дальше», а «нет сети» — это
 * «остановись и скажи», и склеивание их в один `catch` — ровно та ошибка, из-за которой
 * пустая рабочая область выглядит как пустой проект.
 *
 * @module host/workspace/source
 */

/**
 * Ответ источника на чтение текста.
 *
 * `mediaType` — подсказка транспорта (`Content-Type` HTTP-ответа или его аналог). Она имеет
 * приоритет над расширением, но не обязана быть: у файловой системы её нет вовсе.
 */
export interface SourceContent {
  readonly text: string;
  /** Непрозрачный маркер версии. Сравнивается ТОЛЬКО на равенство — «новее» не вычисляется. */
  readonly revision?: string;
  readonly mediaType?: string;
}

/** Ответ источника на чтение байтов. */
export interface SourceBytes {
  readonly bytes: Uint8Array;
  readonly revision?: string;
  readonly mediaType?: string;
}

/** Запись одного уровня каталога. Один уровень — одно обращение, без N+1 на каждый файл. */
export interface SourceEntry {
  readonly name: string;
  /** Путь внутри источника: разделитель `/`, без ведущего слэша. */
  readonly path: string;
  readonly kind: 'file' | 'directory';
}

/** Свойства ресурса в источнике. `null` вместо записи означает «этого там нет». */
export interface SourceStat {
  readonly kind: 'file' | 'directory';
  readonly revision?: string;
  readonly size?: number;
  readonly mediaType?: string;
}

/** Что источник сообщает после записи. Новая ревизия нужна, чтобы следующий `save` не конфликтовал. */
export interface SourceWritten {
  readonly revision?: string;
}

/**
 * То, что Workspace умеет спросить у источника.
 *
 * Всё, чего здесь нет, Workspace не делает: он не создаёт каталогов, не удаляет и не
 * переименовывает — эти операции придут отдельными командами поверх полного `Source`.
 */
export interface WorkspaceSource {
  /** Идентификатор источника: первая половина {@link import('../primitives/resource').ResourceId}. */
  readonly id: string;

  /**
   * Читает текст.
   *
   * Отсутствие ресурса — отказ с `kind: 'not-found'`, а не `null`: у чтения нет осмысленного
   * пустого ответа, а различать «пустой файл» и «файла нет» обязаны и вызывающий, и догрузка.
   */
  read(path: string): Promise<SourceContent>;

  /**
   * Читает байты. Необязателен: там, где его нет, Workspace кодирует текст сам —
   * для источника, отдающего только текст, это не потеря, а честное описание его возможностей.
   */
  readBytes?(path: string): Promise<SourceBytes>;

  /** Один уровень каталога одним обращением. */
  list(dir: string): Promise<readonly SourceEntry[]>;

  /** Свойства или `null`. Заменяет собой проверку существования — она стоит столько же. */
  stat(path: string): Promise<SourceStat | null>;

  /**
   * Пишет текст. Необязателен: источник только на чтение просто не объявляет метод.
   *
   * `expected` — ревизия, которую Workspace считает текущей. При расхождении источник обязан
   * отказать с `kind: 'conflict'` и вернуть в отказе СВОЮ текущую ревизию: без неё диалог
   * слияния не может показать, с чем именно разошлись. Без `expected` — перезапись.
   */
  write?(path: string, text: string, expected?: string): Promise<SourceWritten>;
}

/** Виды отказов источника. Совпадают с `SourceErrorKind` из Э3 — это один и тот же набор. */
export type SourceErrorKind =
  | 'not-found'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'unsupported'
  | 'budget'
  | 'network'
  | 'aborted';

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

/** Форма отказа источника, на которую Workspace смотрит. */
export interface SourceErrorLike {
  readonly kind: SourceErrorKind;
  readonly path?: string;
  /** Для `conflict` — текущая ревизия у источника, то есть та, с которой мы разошлись. */
  readonly revision?: string;
  readonly message: string;
}

/**
 * Отказ ли это источника (и того ли вида).
 *
 * Проверка структурная, а не `instanceof`: класс живёт в Э3, а Workspace обязан работать
 * с любым его двойником, включая тот, что напишут в тестах Э3 отдельно от нашего.
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
