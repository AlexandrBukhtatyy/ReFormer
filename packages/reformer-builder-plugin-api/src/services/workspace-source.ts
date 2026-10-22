/**
 * Источник проекта — то, что лежит в папке проекта на самом деле, мимо рабочей копии.
 *
 * ## Чем это не `WorkspaceFilesService` (`./workspace-files`)
 *
 * Служба записей рабочей области отвечает про РАБОЧУЮ КОПИЮ: её `readText` отдаёт текст с
 * несохранёнными правками и для этого копирует файл из источника в хранилище браузера. Эта
 * служба отвечает про ИСТОЧНИК: текст таким, каким он сохранён, и ничего не копирует. Вопросы
 * разные — «что я сейчас правлю» и «что лежит на диске», — и подменять один другим нельзя:
 * чтение всего проекта через рабочую копию заполнило бы её файлами, которые никто не открывал.
 *
 * ## Отказы — значения с видом
 *
 * Служба записей сводит отказ к `null` и пустому списку: её спрашивают, чтобы показать или не
 * затереть, и «не знаю» там равно «нет». Здесь читают, чтобы РАССКАЗАТЬ о результате — модели
 * или человеку, — и «файла нет», «папку не дали читать» и «это картинка» требуют разных слов.
 * Поэтому каждый ответ — {@link SourceResult} с видом отказа.
 *
 * ## Без особого права
 *
 * Данные те же, что плагин уже может прочитать службой записей, а побочных эффектов меньше:
 * служба только читает и рабочую копию не трогает. Право в манифесте охраняло бы то, что и так
 * открыто, — поэтому его нет.
 *
 * @module @reformer/builder-plugin-api/services/workspace-source
 */

import { defineCapability, type Capability } from '../primitives/capability.js';
import type { ResourceId, ResourceRef } from '../primitives/resource.js';

/**
 * Вид отказа:
 * - `no-project` — проект не открыт;
 * - `not-found` — такого ресурса в источнике нет (или адрес чужого проекта);
 * - `is-directory` — текст спросили у каталога;
 * - `not-text` — ресурс двоичный, текстом его не прочесть;
 * - `too-large` — ресурс больше разрешённого размера;
 * - `unauthorized` — доступ к папке не выдан или отозван: нужно открыть проект заново;
 * - `forbidden` — адрес выводит за корень проекта;
 * - `budget` — в каталоге слишком много записей для листинга;
 * - `aborted` — чтение остановлено сигналом;
 * - `failed` — прочий сбой ввода-вывода.
 */
export type SourceReadErrorKind =
  | 'no-project'
  | 'not-found'
  | 'is-directory'
  | 'not-text'
  | 'too-large'
  | 'unauthorized'
  | 'forbidden'
  | 'budget'
  | 'aborted'
  | 'failed';

/** Отказ с видом и фразой для диагностики. */
export interface SourceReadError {
  readonly kind: SourceReadErrorKind;
  readonly message: string;
}

/** Ответ службы: значение или отказ. Исключений служба не бросает. */
export type SourceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SourceReadError };

/** Что известно о ресурсе без чтения содержимого. */
export interface SourceStat {
  readonly kind: 'file' | 'directory';
  /** Медиатип — только у файла. */
  readonly mediaType?: string;
  /** Размер в байтах, если источник его знает. */
  readonly size?: number;
}

/** Текст ресурса из источника. */
export interface SourceText {
  readonly text: string;
  readonly mediaType: string;
}

/** Общие параметры чтения. */
export interface SourceReadOptions {
  /** Остановить ожидание. Отказ — `aborted`. */
  readonly signal?: AbortSignal;
}

export interface WorkspaceSourceService {
  /** Файл это или каталог — без чтения содержимого. */
  stat(id: ResourceId, options?: SourceReadOptions): Promise<SourceResult<SourceStat>>;
  /**
   * Один уровень каталога таким, каким он лежит в источнике: файлы, созданные в рабочей копии
   * и ещё не сохранённые, сюда не входят. Каталоги идут первыми, внутри — по имени.
   */
  list(dir: ResourceId, options?: SourceReadOptions): Promise<SourceResult<readonly ResourceRef[]>>;
  /**
   * Сохранённый текст файла. Рабочую копию не читает и в неё не пишет.
   *
   * Двоичный ресурс — `not-text`, каталог — `is-directory`, файл больше `maxBytes`
   * (по умолчанию 1 МиБ) — `too-large`: размер проверяется до чтения содержимого.
   */
  readText(
    id: ResourceId,
    options?: SourceReadOptions & { readonly maxBytes?: number }
  ): Promise<SourceResult<SourceText>>;
}

/**
 * Возможность «источник проекта». Провайдер — оболочка: служба существует с запуска и без
 * проекта отвечает отказом `no-project`.
 */
export const WorkspaceSourceCapability: Capability<WorkspaceSourceService> =
  defineCapability<WorkspaceSourceService>({ id: 'reformer.workspace.source', version: '1.0.0' });

/** Токен службы — ТОТ ЖЕ объект: возможность расширяет токен, второго реестра нет. */
export const WorkspaceSourceServiceToken = WorkspaceSourceCapability;
