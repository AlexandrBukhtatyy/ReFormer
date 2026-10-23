/**
 * Попытка хода файлового режима: всё, что инструменты знают о модуле формы и через что пишут.
 *
 * Инструменты не ходят в порт файлов сами — только через попытку. Так у записи одна дверь, и
 * за ней стоит всё, что запись обязана сделать: пометка происхождения `{ origin: 'agent', txId }`
 * (без неё правка машины попала бы в журнал рабочей области как правка человека), учёт в
 * журнале хода (из него собирается отмена) и запоминание того, что модель видела.
 *
 * ## «Что модель видела»
 *
 * `write_file` заменяет файл целиком, и заменить им файл, которого модель не читала, значит
 * стереть то, о чём она не знает. Попытка помнит текст каждого прочитанного файла: заменить
 * можно только прочитанный и только если он с тех пор не менялся — правкой человека или
 * другим вызовом того же хода. Память — на попытку, а не на ход: вторая попытка начинается
 * с новой затравки, и прежние чтения в её контексте могут не уцелеть.
 *
 * @module plugins/reformer/ai/files/turn
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { AiFiles, FileScope, WriteMark } from '../host';
import type { KnowledgeLoader } from '../knowledge';
import type { ToolContext } from '../model/types';
import type { FileJournal } from '@reformer/builder-toolkit';
import { moduleFileOf, type ModuleFile } from './scope';
import { moduleFiles } from './tree';
import type { ToolOutcome } from '../model/types';

/** Попытка хода над файлами модуля. */
export interface FileTurn {
  readonly scope: FileScope;
  readonly journal: FileJournal;
  /** Корпус знаний — для проверки кода правил; `undefined` — проверять нечем. */
  readonly knowledge?: KnowledgeLoader;
  /** Файл модуля по пути модели либо отказ `PATH_REFUSED`. */
  file(path: string): ModuleFile | ToolOutcome;
  /** Текст файла сейчас; `null` — файла нет. */
  read(file: ModuleFile): Promise<string | null>;
  /** Текст файла по пути от корня модуля — для сборки формы. */
  readPath(rel: string): Promise<string | null>;
  /** Файлы модуля — пути от корня, вместе с созданными в этом ходе. */
  moduleFiles(): Promise<string[]>;
  /** Запомнить, каким модель видела файл. */
  see(rel: string, text: string): void;
  /** Каким модель видела файл в этой попытке; `undefined` — не читала. */
  seen(rel: string): string | undefined;
  /** Записать файл: пометка хода, журнал, «модель видела то, что записала». */
  write(file: ModuleFile, before: string | null, text: string): Promise<void>;
  /** Форма, собранная из файлов на начало попытки, — база гейта. */
  readonly base: JsonFormSchema;
  /** Форма после последней принятой записи схемы. */
  draft(): JsonFormSchema;
  setDraft(schema: JsonFormSchema): void;
}

/** Контекст инструментов файлового режима. */
export interface FileToolContext extends ToolContext {
  readonly files: FileTurn;
}

/** Из чего собирается попытка. */
export interface FileTurnOptions {
  readonly files: Omit<AiFiles, 'scopeOf'>;
  readonly scope: FileScope;
  /** Журнал ХОДА — общий для обеих попыток. */
  readonly journal: FileJournal;
  /** Пометка записей: `{ origin: 'agent', txId }` — одна на ход. */
  readonly mark: WriteMark;
  /** Форма из файлов на начало попытки. */
  readonly base: JsonFormSchema;
  readonly knowledge?: KnowledgeLoader;
}

export function createFileTurn(options: FileTurnOptions): FileTurn {
  const { files, scope, journal, mark } = options;
  const seen = new Map<string, string>();
  let draft = options.base;

  return {
    scope,
    journal,
    ...(options.knowledge ? { knowledge: options.knowledge } : {}),
    file: (path) => moduleFileOf(files, scope, path),
    read: (file) => files.read(file.id),
    readPath: (rel) => files.read(files.resolve(scope.root, ...rel.split('/'))),
    moduleFiles: () => moduleFiles(files, scope, journal),
    see: (rel, text) => {
      seen.set(rel, text);
    },
    seen: (rel) => seen.get(rel),
    async write(file, before, text) {
      await files.write(file.id, text, mark);
      journal.record(file.id, file.rel, before, text);
      // Записанное модель знает дословно — она его и прислала. Следующая замена файла целиком
      // не обязана перечитывать его ради проверки «не менялся ли».
      seen.set(file.rel, text);
    },
    base: options.base,
    draft: () => draft,
    setDraft: (schema) => {
      draft = schema;
    },
  };
}
