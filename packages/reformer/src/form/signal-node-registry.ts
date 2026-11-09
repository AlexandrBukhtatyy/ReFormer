/**
 * Реестр «ручка модели → нода формы».
 *
 * По нему находят ноду state-операции behavior (`enableWhen`/`disableWhen`), подключение
 * под-схем (`apply`/`applyEach`) и разнос ошибок валидации. Заполняется в `createForm` при сборке
 * формы из модели.
 *
 * Ключ — ИДЕНТИЧНОСТЬ ручки дерева `model.$`, а не путь: сигнал листа, узел-массив или узел-группа.
 * Путь для этого не годится: он абсолютный (`items.0.phones`) и меняется при перестановке строк, а
 * форма строки массива — отдельный корень со своими относительными путями.
 *
 * Используется `WeakMap`, поэтому записи авто-собираются GC вместе с ручками.
 *
 * Кто пишет и кто читает. Пишет сборка формы (`create-form`). Читают валидация — разнос замечаний,
 * `pending`, касание полей, триггер `blur` — и поведение — state-операции и подключение под-схем.
 * Уровень формы, отправка и поток шагов реестр не импортируют (запрет в ESLint): ноды им достаются
 * через раннер валидации.
 *
 * ## Общий реестр и область сборки
 *
 * Над одной моделью можно собрать несколько форм, и у одной ручки тогда несколько нод. Общий
 * реестр помнит последнюю — так отвечает публичный {@link getNodeForSignal}. Сборке этого мало:
 * её проверка, поведение и рендерер должны попадать в СВОИ ноды, а не в ноды последней собранной
 * формы. Поэтому у сборки есть область ({@link createNodeScope}): ноду ручки она ищет сначала у
 * себя, и только для чужих ручек — в общем реестре. Явная перепривязка {@link registerSignalNode},
 * сделанная после сборки, главнее её собственной ноды — как и в общем реестре, побеждает последняя
 * запись.
 *
 * @group Utils
 * @module form/signal-node-registry
 */

import type { FormNode } from './types/nodes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = FormNode<any>;

/** Запись с порядковым номером: из двух записей одной ручки главнее более поздняя. */
interface Entry {
  readonly node: AnyNode;
  readonly seq: number;
}

/** Общий реестр: последняя записанная нода ручки — сборкой или явной перепривязкой. */
const registry = new WeakMap<object, AnyNode>();

/** Явные перепривязки {@link registerSignalNode} — их сверяет с собственными нодами область сборки. */
const explicit = new WeakMap<object, Entry>();

let seq = 0;

/**
 * Связать ручку модели с её нодой формы.
 *
 * Сборка формы (`createForm`/{@link createFormFromModel}) заполняет реестр сама — для каждого поля,
 * группы и массива под-форм; у группы в реестре лежит её лицо {@link FormGroup} с нодами полей.
 * Прикладной код зовёт эту функцию, чтобы перепривязать ручку к ноде другой сборки: перепривязка
 * действует и на сборку, которой ручка принадлежит, пока эту ручку не перезапишет новая сборка.
 *
 * @param signal - Ручка из {@link FormModel}: сигнал листа, узел-массив или узел-группа дерева `model.$`
 * @param node - Нода формы, отвечающая за эту часть модели
 *
 * @example Ручка модели указывает на ноду другой сборки
 * ```typescript
 * import { registerSignalNode } from '@reformer/core';
 *
 * registerSignalNode(model.$.profile.email, profileForm.email);
 * ```
 *
 * @see {@link getNodeForSignal} - обратный поиск ноды по ручке
 * @group Utilities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerSignalNode(signal: object, node: FormNode<any>): void {
  registry.set(signal, node);
  explicit.set(signal, { node, seq: ++seq });
}

/**
 * Найти ноду формы по ручке модели.
 *
 * Возвращает `undefined`, если форма ещё не построена или эта часть модели в форме не
 * материализована (например, массив без item-схемы).
 *
 * Если над моделью собрано несколько форм, у ручки несколько нод, и здесь — нода последней
 * собранной формы (или явной перепривязки {@link registerSignalNode}). Ноду конкретной сборки
 * отдаёт `bundle.render.nodeOf(handle)`: через неё проверка, поведение и рендерер сборки и
 * находят свои ноды.
 *
 * @param signal - Ручка из {@link FormModel}: `model.$.<поле>`, `model.$.<группа>`, `model.$.<массив>`
 * @returns Нода формы — поля, группы или массива — либо `undefined`
 *
 * @example Роутинг ошибок валидации в ноду поля
 * ```typescript
 * import { getNodeForSignal } from '@reformer/core';
 *
 * const sig = model.$.email;
 * getNodeForSignal(sig)?.setIssues([{ code: 'required' }]);
 * ```
 *
 * @example Нода группы и строки массива
 * ```typescript
 * getNodeForSignal(model.$.address)?.disable(); // группа целиком
 * getNodeForSignal(model.$.phones[0])?.markAsTouched(); // форма строки массива
 * ```
 *
 * @see {@link registerSignalNode} - регистрация связи ручка→нода
 * @group Utilities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNodeForSignal(signal: object): FormNode<any> | undefined {
  return registry.get(signal);
}

/**
 * Ноды одной сборки формы: по ручке модели — нода именно этой сборки.
 *
 * Сборка создаёт область ({@link createNodeScope}) и регистрирует в ней свои ноды; проверка,
 * поведение и рендерер сборки ищут ноды через неё. Раннер без сборки (`validateModel`) берёт
 * {@link GLOBAL_NODES} — общий реестр.
 *
 * @internal
 */
export interface NodeScope {
  /** Записать ноду ручки в область — и в общий реестр, как последнюю собранную. */
  register(handle: object, node: AnyNode): void;
  /**
   * Нода ручки: своя нода сборки, если после неё ручку явно не перепривязали; для чужой ручки —
   * нода общего реестра.
   */
  get(handle: object): AnyNode | undefined;
}

/**
 * Создать область нод сборки.
 *
 * @internal
 */
export function createNodeScope(): NodeScope {
  const own = new WeakMap<object, Entry>();
  return {
    register(handle, node) {
      own.set(handle, { node, seq: ++seq });
      registry.set(handle, node);
    },
    get(handle) {
      const mine = own.get(handle);
      // Чужая ручка — как в общем реестре: последняя запись, сборкой или перепривязкой.
      if (mine === undefined) return registry.get(handle);
      const redirect = explicit.get(handle);
      return redirect !== undefined && redirect.seq > mine.seq ? redirect.node : mine.node;
    },
  };
}

/**
 * Область без сборки — общий реестр: последняя записанная нода ручки.
 *
 * @internal
 */
export const GLOBAL_NODES: NodeScope = {
  register: registerSignalNode,
  get: getNodeForSignal,
};
