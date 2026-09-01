/**
 * Надстройка модели над открываемым документом — единственное место, где зовётся
 * `attachDocumentModel`.
 *
 * ## Почему это композиция, а не рабочая область
 *
 * Платформа умеет два вида документа, но **собрать** второй вид может только тот, у кого
 * на руках все три недостающие вещи: реестр вкладов (кто вызвался разбирать этот ресурс),
 * служба диагностик (куда уйдёт ошибка разбора) и ответ «печатает ли человек прямо сейчас»
 * (реестр фокуса текстового редактора). Ни одной из них у `Workspace` нет и быть не должно:
 * вклады принадлежат рантайму плагинов, а фокус — интерфейсу.
 *
 * ## Почему обёртка над `open`, а не пост-обработка
 *
 * Вид документа обязан быть известен ТОМУ ЖЕ вызову, который его открыл. Хранилище вкладок
 * кладёт полученный документ к себе и по нему же отвечает `documentOf` и `activeResourceKind`
 * (у модельного это `providerId`, у текстового — медиатип). Надстрой мы модель после открытия —
 * у вкладок остался бы текстовый документ, а предикаты панелей и валидатор схемы, которые
 * спрашивают именно вид, никогда бы не сработали.
 *
 * Отсюда форма: {@link DocumentModels.open} подставляется вкладкам вместо `workspace.open`,
 * а сами вкладки про модель по-прежнему не знают ничего.
 *
 * ## Три исхода надстройки, и все три нормальные
 *
 * ```text
 * провайдера нет                → документ текстовый, ручки нет
 * провайдер есть, разбор удался → модельный документ и ручка к нему
 * провайдер есть, разбор упал   → документ ТЕКСТОВЫЙ + диагностика разбора
 * ```
 *
 * Третий случай — не авария: у документа с моделью обязана быть «последняя валидная модель»
 * с первой секунды, а у файла, который не разобрался ни разу, её нет.
 *
 * @module app/document-models
 */

import type { Disposable } from '@/shell/platform/primitives/disposable';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import type { ExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { Document } from '@/shell/platform/workspace/document';
import {
  attachDocumentModel,
  type ModelDocumentHandle,
} from '@/shell/platform/workspace/model/model-document';
import type { DiagnosticsSink, Workspace } from '@/shell/platform/workspace/workspace';

/**
 * Рабочая область в объёме, нужном надстройке.
 *
 * `Pick`, а не свой порт, по той же причине, что у вкладок и у строки состояния: форма обязана
 * совпадать с настоящей рабочей областью буква в букву, иначе расхождение вскроется
 * на композиции, а не на типах.
 */
export type ModelsWorkspace = Pick<
  Workspace,
  'open' | 'close' | 'writeText' | 'openedResources' | 'onDidChange'
>;

export interface DocumentModelsOptions {
  readonly workspace: ModelsWorkspace;
  /** Реестр вкладов: в нём лежат провайдеры модели, внесённые плагинами. */
  readonly extensions: Pick<ExtensionRegistry, 'get'>;
  /** Куда уходит ошибка разбора. Без него надстройка работает, но молча. */
  readonly diagnostics?: DiagnosticsSink;
  /**
   * В фокусе ли текстовый редактор этого документа.
   *
   * Функция, а не флаг: фокус меняется чаще, чем документ, и спрашивать его надо в момент
   * решения «перерисовывать буфер сейчас или отложить». Про Monaco здесь не знает никто —
   * ответ даёт реестр фокуса, который композиция отдала и редактору тоже.
   */
  readonly isTextEditorFocused?: (id: ResourceId) => boolean;
  readonly historyLimit?: number;
}

/** Держатель модельных документов рабочей сессии. */
export interface DocumentModels extends Disposable {
  /**
   * Открывает ресурс и надстраивает над ним модель, если кто-то за него взялся.
   *
   * Подставляется хранилищу вкладок вместо `workspace.open` и обязан сохранять его гарантию:
   * повторное открытие отдаёт ТОТ ЖЕ документ. Поэтому ручка кэшируется по ресурсу —
   * вторая надстройка над тем же буфером означала бы две модели, две истории и две записи
   * на каждую правку.
   */
  open(id: ResourceId): Promise<Document>;
  /**
   * Закрывает ресурс и снимает надстроенную над ним модель.
   *
   * Пара к {@link open} и подставляется вкладкам вместе с ним. Снятие идёт ЗДЕСЬ, а не
   * по событию рабочей области: закрытие ресурса не порождает изменений содержимого,
   * то есть пакета изменений может не быть вовсе, — а ручка держит подписку на буфер
   * и историю модели, и оставить её значило бы утечку на каждую закрытую вкладку.
   */
  close(id: ResourceId): Promise<void>;
  /**
   * Ручка модельного документа или `null`, если документ текстовый.
   *
   * Отдельно от `documentOf` вкладок намеренно. `Document` — читающее лицо, его держат все:
   * вкладки, дерево, строка состояния, валидация. Ручка — пишущее: она правит модель, ведёт
   * историю и перерисовывает буфер. Разведение `Document`/`DocumentHandle` в платформе
   * заведено ровно затем, чтобы править мог только владелец; слей мы их обратно в один ответ —
   * право на правку получил бы каждый, кто попросил документ вкладки.
   */
  handleOf(id: ResourceId): ModelDocumentHandle<unknown> | null;
}

export function createDocumentModels(options: DocumentModelsOptions): DocumentModels {
  const { workspace, extensions } = options;
  const focused = options.isTextEditorFocused ?? ((): boolean => false);
  const handles = new Map<ResourceId, ModelDocumentHandle<unknown>>();

  const drop = (id: ResourceId): void => {
    const handle = handles.get(id);
    if (handle === undefined) return;
    handles.delete(id);
    handle.dispose();
  };

  /**
   * Убирает ручки ресурсов, которые рабочая область больше не держит открытыми.
   *
   * Подписка, а не снятие в `close`: вкладка исчезает не только по закрытию (ресурс могли
   * удалить, проект — сменить), а ручка держит подписку на буфер и историю модели. Пакет
   * изменений приходит на каждую такую перемену, и сверка по нему — единственное место,
   * где ни один путь исчезновения не потеряется.
   */
  const subscription = workspace.onDidChange(() => {
    if (handles.size === 0) return;
    const opened = new Set(workspace.openedResources());
    for (const id of [...handles.keys()]) {
      if (!opened.has(id)) drop(id);
    }
  });

  return {
    async open(id) {
      const document = await workspace.open(id);
      // Тот же документ — значит, надстройка над ним уже сделана: `attachDocumentModel`
      // второй раз завёл бы вторую модель над тем же буфером.
      const existing = handles.get(id);
      if (existing !== undefined) return existing.document;
      if (document.kind === 'model') return document;

      const attached = attachDocumentModel({
        document,
        extensions,
        writeText: (text) => workspace.writeText(id, text),
        isTextEditorFocused: () => focused(id),
        diagnostics: options.diagnostics,
        historyLimit: options.historyLimit,
      });
      if (attached.handle === undefined) return attached.document;
      handles.set(id, attached.handle);
      return attached.document;
    },

    handleOf: (id) => handles.get(id) ?? null,

    close(id) {
      drop(id);
      return workspace.close(id);
    },

    dispose() {
      subscription.dispose();
      for (const id of [...handles.keys()]) drop(id);
    },
  };
}
