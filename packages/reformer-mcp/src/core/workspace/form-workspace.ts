/**
 * Порт для `form_build`: каталог формы в проекте потребителя и проверка типов.
 *
 * Модель присылает только путь каталога, поэтому границы проверяет адаптер: путь обязан лежать внутри
 * проекта. Имена файлов задаёт сборка, а не модель. Ядро диска не знает: в браузере порта нет, и
 * инструмента там тоже нет — он отвечал бы обещанием, которое некому выполнить.
 *
 * @module reformer-mcp/core/workspace/form-workspace
 */

/** Файл модуля формы: плоское имя и содержимое. */
export interface FormFile {
  readonly path: string;
  readonly content: string;
}

/** Ошибка компилятора в файле модуля. */
export interface TypeDiagnostic {
  readonly file: string;
  readonly line: number | null;
  readonly message: string;
  /** Строка кода с ошибкой: по ней агент находит нужную запись intent. */
  readonly source: string;
}

export type TypecheckResult =
  | { readonly status: 'checked'; readonly diagnostics: readonly TypeDiagnostic[] }
  /** Проверить нечем: нет `typescript` либо `@reformer/*` не резолвятся. Это не «ошибок нет». */
  | { readonly status: 'unavailable'; readonly reason: string };

export interface FormDirectory {
  /** Путь для сообщений. */
  readonly label: string;
  /** Содержимое файла; `null` — файла нет. */
  read(name: string): string | null;
  write(name: string, content: string): void;
  remove(name: string): void;
  list(): string[];
  /** Проверить типы модуля из этих файлов, не записывая их на диск. */
  typecheck(files: readonly FormFile[]): Promise<TypecheckResult>;
}

export type OpenedFormDirectory =
  | { readonly ok: true; readonly directory: FormDirectory }
  | { readonly ok: false; readonly reason: string };

export interface FormWorkspace {
  /** Каталог создаётся только первой записью: отказ сборки не оставляет следов. */
  open(dir: string): OpenedFormDirectory;
}

/** Среда, где писать некуда. */
export const UNAVAILABLE_FORM_WORKSPACE: FormWorkspace = {
  open: () => ({ ok: false, reason: 'запись файлов формы в этой среде недоступна' }),
};
