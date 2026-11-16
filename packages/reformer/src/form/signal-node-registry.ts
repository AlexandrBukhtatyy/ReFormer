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
 * Где лежит запись. Сборка не пишет по записи на каждое поле в `WeakMap`: ссылку на ноду (или на
 * ленивый лист, который построит ноду при первом чтении) она оставляет в самом узле модели — узел у
 * сборки под рукой, а запись поля дешевле записи в `WeakMap`. Узел модели помнит последнюю сборку;
 * сборка, чья запись уже перезаписана (над моделью собрана ещё одна форма), находит свою ноду по
 * пути узла от своего корня. Ручки не из модели (их привязывают только явно) лежат в `WeakMap`.
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
import { isLazyLeaf, type LazyLeaf } from './nodes/lazy-leaf';
import { kindOf, rawNode } from './nodes/node-kind';
import { modelNodeOf } from '../model/model-signals-proxy';
import type { ModelNode } from '../model/model-nodes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = FormNode<any>;

/** Запись реестра: нода либо ленивый лист — его нода строится при чтении. */
type Slot = AnyNode | LazyLeaf;

const resolve = (slot: Slot | undefined): AnyNode | undefined =>
  isLazyLeaf(slot) ? slot.node : slot;

/** Запись с порядковым номером: из двух записей одной ручки главнее более поздняя. */
interface Entry {
  readonly node: Slot;
  readonly seq: number;
}

/**
 * Привязка узла модели к ноде сборки — в поле `formSlot` узла. Ленивый лист и есть такая привязка
 * (`scope` + `node`); у контейнеров — пара.
 */
interface Bound {
  readonly scope: NodeScope;
  readonly node: AnyNode;
}

/** Ручки не из модели: последняя записанная нода — сборкой или явной перепривязкой. */
const registry = new WeakMap<object, Slot>();

/** Явные перепривязки {@link registerSignalNode} — их сверяет с собственными нодами область сборки. */
const explicit = new WeakMap<object, Entry>();

let seq = 0;

/** Последняя запись: привязка сборки или явная перепривязка, если она позже. */
function latest(bound: Bound | undefined, redirect: Entry | undefined): AnyNode | undefined {
  if (redirect !== undefined && (bound === undefined || redirect.seq > bound.scope.seq)) {
    return resolve(redirect.node);
  }
  return bound?.node;
}

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
  explicit.set(signal, { node, seq: ++seq });
  if (modelNodeOf(signal) === undefined) registry.set(signal, node);
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
  const modelNode = modelNodeOf(signal);
  if (modelNode === undefined) return resolve(registry.get(signal));
  return latest(modelNode.formSlot as Bound | undefined, explicit.get(signal));
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
  /**
   * Порядковый номер сборки: явная перепривязка с большим номером главнее нод сборки. Задаётся,
   * когда сборка заканчивает строить ноды ({@link NodeScope.attachRoot}). @internal
   */
  readonly seq: number;
  /**
   * Записать ноду ручки в область — и как последнюю собранную для общего реестра. Ленивый лист
   * строит ноду при первом чтении.
   */
  register(handle: object, node: Slot): void;
  /** То же для узла модели, который у сборки уже есть: без поиска узла по ручке. @internal */
  bind(modelNode: ModelNode, node: Slot): void;
  /**
   * Корень сборки: от него область находит свою ноду по пути узла, если запись в узле модели
   * перезаписала другая сборка. @internal
   */
  attachRoot(root: AnyNode, rootModel: ModelNode): void;
  /**
   * Нода ручки: своя нода сборки, если после неё ручку явно не перепривязали; для чужой ручки —
   * нода общего реестра.
   */
  get(handle: object): AnyNode | undefined;
}

/** Путь узла относительно корня сборки; `undefined` — узел вне её модели. */
function relativeTo(path: string, base: string): string | undefined {
  if (base === '') return path;
  if (path === base) return '';
  return path.startsWith(`${base}.`) ? path.slice(base.length + 1) : undefined;
}

/** Узел модели по пути от корня модели сборки — чтобы путь не совпал случайно с чужой моделью. */
function modelNodeAt(root: ModelNode, path: string): ModelNode | undefined {
  let node: ModelNode | undefined = root;
  if (path === '') return node;
  for (const segment of path.split('.')) {
    if (node === undefined) return undefined;
    if (node.kind === 'group') node = node.children.get(segment);
    else if (node.kind === 'array') node = node.items.peek()[Number(segment)];
    else return undefined;
  }
  return node;
}

/** Нода сборки по пути от её корня: группа → ребёнок по имени, массив → строка по индексу. */
function findByPath(root: AnyNode, path: string): AnyNode | undefined {
  let node: unknown = rawNode(root);
  if (path !== '') {
    for (const segment of path.split('.')) {
      const kind = kindOf(node);
      if (kind === 'group') {
        node = (node as { childAt(key: string): unknown }).childAt(segment);
      } else if (kind === 'array') {
        const row = (node as { rowAt(index: number): object | undefined }).rowAt(Number(segment));
        node = row === undefined ? undefined : rawNode(row);
      } else {
        return undefined;
      }
      if (isLazyLeaf(node)) node = node.node;
      if (node === undefined) return undefined;
    }
  }
  return (kindOf(node) === 'group' ? (node as { proxy: AnyNode }).proxy : node) as AnyNode;
}

/**
 * Создать область нод сборки.
 *
 * @internal
 */
export function createNodeScope(): NodeScope {
  /** Ручки не из модели — их привязывают только явно. */
  let own: WeakMap<object, Entry> | undefined;
  let root: { node: AnyNode; model: ModelNode } | undefined;
  const scope: NodeScope & { seq: number } = {
    seq: 0,
    bind(modelNode, node) {
      modelNode.formSlot = isLazyLeaf(node) ? node : { scope, node };
    },
    register(handle, node) {
      const modelNode = modelNodeOf(handle);
      if (modelNode !== undefined) {
        scope.bind(modelNode, node);
        return;
      }
      (own ??= new WeakMap()).set(handle, { node, seq: ++seq });
      registry.set(handle, node);
    },
    attachRoot(node, rootModel) {
      scope.seq = ++seq;
      root = { node, model: rootModel };
    },
    get(handle) {
      const modelNode = modelNodeOf(handle);
      if (modelNode === undefined) {
        const mine = own?.get(handle);
        // Чужая ручка — как в общем реестре: последняя запись, сборкой или перепривязкой.
        if (mine === undefined) return resolve(registry.get(handle));
        const redirect = explicit.get(handle);
        return resolve(
          redirect !== undefined && redirect.seq > mine.seq ? redirect.node : mine.node
        );
      }
      const bound = modelNode.formSlot as Bound | undefined;
      let mine: AnyNode | undefined;
      if (bound !== undefined && bound.scope === scope) {
        mine = bound.node;
      } else if (root !== undefined) {
        // Запись в узле перезаписала другая сборка над той же моделью — своя нода по пути.
        const path = relativeTo(modelNode.path, root.model.path);
        if (path !== undefined && modelNodeAt(root.model, path) === modelNode) {
          mine = findByPath(root.node, path);
        }
      }
      // Чужая ручка — как в общем реестре.
      if (mine === undefined) return getNodeForSignal(handle);
      const redirect = explicit.get(handle);
      return redirect !== undefined && redirect.seq > scope.seq ? resolve(redirect.node) : mine;
    },
  };
  return scope;
}

/**
 * Область без сборки — общий реестр: последняя записанная нода ручки.
 *
 * @internal
 */
export const GLOBAL_NODES: NodeScope = {
  seq: 0,
  register: (handle, node) => registerSignalNode(handle, resolve(node)!),
  bind: (modelNode, node) => {
    void modelNode;
    void node;
  },
  attachRoot: () => {},
  get: getNodeForSignal,
};
