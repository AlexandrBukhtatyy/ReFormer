/**
 * Модельный документ — второй вид документа поверх текста: истина — модель, буфер — её печать.
 *
 * ## Почему типы здесь, а не в оболочке
 *
 * Редактор модели — плагин СТЕКА: схему ReFormer правит один, форму другого стека — другой.
 * Раньше ручку модели каждому такому редактору собирала оболочка портом, а тип ручки плагин
 * объявлял структурной копией. Копия описывала СВОЮ модель, и оболочке приходилось знать, какой
 * провайдер у какого плагина, — то есть знать стек. Здесь объявлено то, что одинаково у всех
 * моделей; провайдер сужает `M` сам, сверив `document.providerId` со своим идентификатором.
 *
 * Реализация — в оболочке (`platform/workspace/model/model-document`): история, отложенная
 * перерисовка буфера, расхождение. Здесь только форма.
 *
 * @module @reformer/builder-plugin-api/workspace/model/model-document
 */

import type { Disposable } from '../../primitives/disposable.js';
import type { Document } from '../document.js';
import type { ApplyResult, EditOp, NodeId } from './provider.js';

/** Согласован ли буфер с моделью. `diverged` — буфер не разбирается, модель прежняя. */
export type DocumentSyncState = 'synced' | 'diverged';

/** Отказ разбора: чей и почему. */
export interface ParseFailure {
  readonly providerId: string;
  /** Сообщение провайдера: годится для диагностики и для лога, не для интерфейса. */
  readonly message: string;
  /** Исходная ошибка: у разбора с позициями в ней лежит смещение. */
  readonly error?: unknown;
}

/** Что вызвало смену состояния модельного документа. */
export type ModelChangeReason = 'apply' | 'parse' | 'undo' | 'redo' | 'selection';

export interface ModelChange<M> {
  readonly model: M;
  readonly selection: readonly NodeId[];
  readonly syncState: DocumentSyncState;
  readonly reason: ModelChangeReason;
}

/**
 * Документ с моделью. Наследует `Document` целиком: для текстового редактора модельный документ
 * ничем не отличается от обычного, и это осознанно.
 */
export interface ModelDocument<M = unknown> extends Document {
  readonly kind: 'model';
  /** Чей разбор. По нему плагин стека узнаёт СВОЙ документ и сужает модель. */
  readonly providerId: string;
  /** Последняя валидная модель. В расхождении — та, что была до поломки буфера. */
  getModel(): M;
  getSyncState(): DocumentSyncState;
  /** `undefined`, когда согласовано. */
  getParseFailure(): ParseFailure | undefined;
  /** Выделение — часть модели правки: операция переносит его на `focus`, оно входит в снимок отмены. */
  getSelection(): readonly NodeId[];
  /** Ложь в расхождении: структурные редакторы там только на чтение. */
  isStructurallyEditable(): boolean;
  onDidChangeModel(cb: (change: ModelChange<M>) => void): Disposable;
}

/** Отказ применить операцию. Не исключение: оба случая — нормальные состояния, а не аварии. */
export type ApplyRejection =
  /** Буфер не разбирается: правка модели затёрла бы работу пользователя при перерисовке. */
  | { readonly status: 'rejected'; readonly reason: 'diverged'; readonly failure: ParseFailure }
  /** Провайдер не смог применить операцию: неизвестный тип, исчезнувшая цель, битые параметры. */
  | { readonly status: 'rejected'; readonly reason: 'provider-error'; readonly error: unknown };

export type ApplyOutcome<M> = ({ readonly status: 'applied' } & ApplyResult<M>) | ApplyRejection;

export interface ApplyOptions {
  /** Ключ схлопывания в истории, обычно `свойство@узел`. */
  readonly mergeKey?: string;
}

/**
 * Ручки управления модельным документом — пишущее лицо.
 *
 * Разведено с {@link ModelDocument} так же, как документ и его владелец: читать может любой,
 * а править — только через ручку, мимо истории и перерисовки буфера не пройти. Времени жизни
 * здесь нет (`dispose`): ручкой владеет тот, кто открыл документ, то есть оболочка.
 */
export interface ModelDocumentHandle<M> {
  readonly document: ModelDocument<M>;
  /** Применяет операцию: история, перенос выделения на `focus`, перерисовка буфера. */
  apply(op: EditOp, options?: ApplyOptions): ApplyOutcome<M>;
  setSelection(selection: readonly NodeId[]): void;
  /** `false`, если отменять нечего или документ в расхождении. */
  undo(): boolean;
  redo(): boolean;
  /** Ответит ли {@link undo} согласием; расхождение учтено здесь же. */
  canUndo(): boolean;
  canRedo(): boolean;
  /** Явная граница схлопывания: конец хода ассистента, уход фокуса с поля. */
  breakUndoMerge(): void;
  /** Выполняет отложенную перерисовку буфера и дожидается записи. */
  flush(): Promise<void>;
  /** Ждёт ли документ перерисовки буфера, отложенной из-за фокуса. */
  hasPendingSync(): boolean;
}
