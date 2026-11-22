/**
 * Протокол между тонким клиентом (`@reformer/mcp`, у пользователя) и сервисом MCP.
 *
 * Сервис не видит диска пользователя. Клиент кладёт в вызов то, что сервису понадобится —
 * содержимое каталогов формы, тексты спек, каталог кита, результаты проверки типов и состояние
 * сеанса, — а сервис отвечает журналом операций, которые клиент применяет к диску. Чего не
 * хватило, сервис просит в `need`: клиент добирает и повторяет тот же вызов. Пока операции не
 * применены, на диск ничего не пишется, поэтому повтор безопасен.
 *
 * Канал — поле `_meta["reformer/host"]` у параметров запроса (`tools/call`, `resources/read`) и у
 * результата. Его видят только клиент и сервис: агенту клиент отдаёт результат без него.
 *
 * Модуль самодостаточен — без импортов ядра: его делят открытый клиент и закрытый сервис.
 *
 * @module @reformer/mcp/contract/protocol
 */

/** Ключ в `_meta` запроса и результата. */
export const HOST_META_KEY = 'reformer/host';

/** Версия протокола. Несовпадение — отказ сервиса с понятным текстом, а не тихая порча файлов. */
export const HOST_PROTOCOL_VERSION = 1;

/** Ключ каталога формы, когда инструмент не получил `dir`: умолчание выбирает клиент. */
export const DEFAULT_DIR_KEY = '';

/**
 * Ключ каталога формы: `form`, `./form` и `form/` — один каталог. Без этого сборка, открывшая
 * каталог иначе, чем правка в том же вызове, не видела бы её записей.
 */
export function dirKeyOf(dir: string | null): string {
  if (dir === null) return DEFAULT_DIR_KEY;
  const key = dir
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/(\/\.)+$/, '')
    .replace(/\/+$/, '');
  return key === '' || key === '.' ? '.' : key;
}

/** Файл модуля формы. */
export interface HostFile {
  readonly path: string;
  readonly content: string;
}

/** Ошибка компилятора в файле модуля. */
export interface HostTypeDiagnostic {
  readonly file: string;
  readonly line: number | null;
  readonly message: string;
  readonly source: string;
  readonly code?: number;
}

/** Результат проверки типов у клиента — тот же, что у порта `FormDirectory.typecheck`. */
export type HostTypecheckResult =
  | { readonly status: 'checked'; readonly diagnostics: readonly HostTypeDiagnostic[] }
  | {
      readonly status: 'unavailable';
      readonly reason: string;
      readonly missing?: readonly string[];
    };

/** Каталог формы у клиента. */
export type HostDirectory =
  | { readonly ok: false; readonly reason: string }
  | {
      readonly ok: true;
      /** Путь для сообщений — от корня проекта. */
      readonly label: string;
      /** Все файлы каталога: имя → содержимое. Каталога нет — пусто. */
      readonly files: Readonly<Record<string, string>>;
      /** Файлы с этим именем выше каталога, до корня проекта: имя → пути, ближний первым. */
      readonly above?: Readonly<Record<string, readonly string[]>>;
    };

/** Что клиент кладёт в вызов. */
export interface HostRequest {
  readonly v: number;
  /** Состояние сеанса каталога инструментов (`SerializedToolSessionState`). */
  readonly state?: unknown;
  /** Каталоги формы: аргумент `dir` как есть ({@link DEFAULT_DIR_KEY} — без него) → каталог. */
  readonly dirs?: Readonly<Record<string, HostDirectory>>;
  /** Спеки: ссылка как есть → текст; `null` — не найдена. */
  readonly specs?: Readonly<Record<string, string | null>>;
  /** Относительно чего резолвится ссылка на спеку — для сообщения «не найдено». */
  readonly specBase?: string;
  /**
   * Каталог кита. `hash` — отпечаток, `json` — сам каталог (сервис кэширует по отпечатку и просит
   * его только при промахе); `null` — кит не установлен.
   */
  readonly uiKitCatalog?: { readonly hash: string; readonly json?: unknown } | null;
  /** Результаты проверки типов: ключ из `need.typechecks` → результат. */
  readonly typechecks?: Readonly<Record<string, HostTypecheckResult>>;
  /** Куда клиент пишет отчёты `report_issue` — для сообщений. */
  readonly issuesLocation?: string;
  /** Что клиент знает о проекте и пакетах — для `reformer://status`. */
  readonly platform?: unknown;
}

/** Чего не хватило вызову. */
export interface HostNeed {
  readonly dirs?: readonly string[];
  readonly above?: ReadonlyArray<{ readonly dir: string; readonly name: string }>;
  readonly specs?: readonly string[];
  readonly uiKitCatalog?: boolean;
  /** Проверить типы этих файлов в каталоге `dir` и вернуть результат под ключом `key`. */
  readonly typechecks?: ReadonlyArray<{
    readonly key: string;
    readonly dir: string;
    readonly files: readonly HostFile[];
  }>;
  readonly platform?: boolean;
}

/** Операция над диском клиента. */
export type HostOp =
  | { readonly op: 'write'; readonly dir: string; readonly name: string; readonly content: string }
  | { readonly op: 'remove'; readonly dir: string; readonly name: string }
  | { readonly op: 'issue'; readonly baseName: string; readonly payload: string };

/** Что сервис кладёт в результат. */
export interface HostResponse {
  readonly v: number;
  /** Чего не хватило. Есть — результат вызова недействителен: клиент добирает и повторяет. */
  readonly need?: HostNeed;
  /** Операции над диском — в порядке выполнения. */
  readonly ops?: readonly HostOp[];
  /** Новое состояние сеанса. Нет — прежнее не изменилось. */
  readonly state?: unknown;
  /** Каталоги формы, которые открыл вызов: клиент кладёт их в следующий вызов сразу. */
  readonly dirs?: readonly string[];
}

/** Сколько раз клиент повторяет вызов, добирая недостающее, прежде чем сдаться. */
export const MAX_HOST_ROUNDS = 6;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Блок протокола из `_meta`; нет или не тот — `undefined`. */
export function hostMetaOf(meta: unknown): Record<string, unknown> | undefined {
  if (!isRecord(meta)) return undefined;
  const block = meta[HOST_META_KEY];
  return isRecord(block) ? block : undefined;
}
