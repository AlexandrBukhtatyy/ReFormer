/**
 * Области видимости модели формы: какие пути `$model(...)` видны в данном месте схемы.
 *
 * ## Две позиции `$model`, и модель строится только из одной
 *
 * `$model(path)` в схеме бывает в двух ролях, и сегодня их никто не различал:
 *
 * ```text
 * ОБЪЯВЛЕНИЕ   value поля, array массива            → из них синтезируется модель
 * ЧТЕНИЕ       текстовая часть children,             → читает сигнал, которого может не быть
 *              значение componentProps
 * ```
 *
 * Модель в билдере СИНТЕЗИРУЕТСЯ из объявлений (`form-mock`.`collectFieldDefaults`), поэтому
 * чтение пути, который никто не объявил, в рантайме даёт `No model signal` в консоли и пустоту
 * на экране — молчаливый no-op. Это различие и есть то, что дают функции модуля: подсказке
 * — список объявленного, проверке — места чтения.
 *
 * ## Область — это шаблон элемента массива
 *
 * Внутри `item.$template` пути ОТНОСИТЕЛЬНЫ элементу: конвертер рендерера строит шаблон над
 * подмоделью элемента. Поэтому каждый шаблон — своя область, а сам `array` массива объявлен
 * во внешней. Шаги мастера (`componentProps.steps`) и обёртка поля области не открывают.
 *
 * ## Почему не `collectModelPaths`
 *
 * Тот смешивает обе роли (берёт и `value`, и `$model` текстовой части), не видит шаблонов и
 * пропсов — и на нём стоит целостность правил ({@link './rules-integrity'}). Менять его смысл
 * ради подсказок значило бы молча поменять, какие правила считаются осиротевшими.
 *
 * @module @reformer/builder-stack-reformer/form-model/model-scopes
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonContainerNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike } from './node-kind';
import { pathEquals, type JsonPath } from './paths';
import { walkNodes } from './query';

/** Хвост пути, которым открывается область элемента массива. */
const TEMPLATE_TAIL: JsonPath = ['item', '$template'];

/** Область видимости модели: корень формы либо подмодель элемента массива. */
export interface ModelScope {
  /** Путь узла-массива, чей `item.$template` образует область; `[]` — корень формы. */
  readonly at: JsonPath;
  /** Пути, ОБЪЯВЛЕННЫЕ в области (`value` полей, `array` массивов), без повторов, по обходу. */
  readonly bound: readonly string[];
}

/** Место, где `$model(...)` ЧИТАЕТСЯ, а не объявляется. */
export interface ModelRead {
  /** Узел, которому место принадлежит. */
  readonly node: JsonNode;
  /** Путь узла от корня файла. */
  readonly nodePath: JsonPath;
  /** Путь от узла до строки с оператором (`['children', 1]`, `['componentProps', 'title']`). */
  readonly within: JsonPath;
  /** Аргумент оператора. */
  readonly path: string;
  /** Область, в которой чтение происходит ({@link ModelScope.at}). */
  readonly scope: JsonPath;
}

/**
 * Область, которой принадлежит место с путём `path`: ближайший шаблон элемента массива,
 * накрывающий его, либо корень.
 *
 * Работает для любого пути в файле, не только для пути узла — поэтому годится и позиции курсора
 * в тексте, и узлу из инспектора. Сам массив в свою область не входит: его путь шаблоном
 * не накрыт.
 */
export function scopeOfPath(path: JsonPath): JsonPath {
  for (let end = path.length; end >= TEMPLATE_TAIL.length; end -= 1) {
    if (path[end - 2] === TEMPLATE_TAIL[0] && path[end - 1] === TEMPLATE_TAIL[1]) {
      return path.slice(0, end - 2);
    }
  }
  return [];
}

/** Аргумент `$model(...)`, если значение — этот оператор. */
function modelArg(value: unknown): string | undefined {
  const parsed = parseOperator(value);
  return parsed?.op === 'model' ? parsed.arg : undefined;
}

/**
 * Все области схемы: корень первым, дальше шаблоны массивов в порядке обхода.
 *
 * Корень есть всегда, даже пустой, — у формы без привязок область всё равно одна, и искать
 * её по `at: []` должно быть можно без проверки на отсутствие.
 */
export function collectModelScopes(schema: JsonFormSchema): readonly ModelScope[] {
  const byKey = new Map<string, { at: JsonPath; bound: string[]; seen: Set<string> }>();
  const scopeFor = (at: JsonPath) => {
    const key = JSON.stringify(at);
    let scope = byKey.get(key);
    if (scope === undefined) {
      scope = { at, bound: [], seen: new Set() };
      byKey.set(key, scope);
    }
    return scope;
  };
  scopeFor([]);

  walkNodes(schema, (node, path) => {
    // Шаблон открывает область, даже если в нём нет ни одной привязки: подсказке внутри
    // пустого шаблона нужен пустой ответ, а не ответ корня.
    if (isArrayNode(node)) scopeFor(path);

    const arg = isArrayNode(node)
      ? modelArg(node.array)
      : isFieldNode(node)
        ? modelArg(node.value)
        : undefined;
    if (arg === undefined) return;
    const scope = scopeFor(scopeOfPath(path));
    if (!scope.seen.has(arg)) {
      scope.seen.add(arg);
      scope.bound.push(arg);
    }
  });

  return [...byKey.values()].map(({ at, bound }) => ({ at, bound }));
}

/** Объявленные пути области `at`; неизвестная область — пусто. */
export function boundPathsIn(scopes: readonly ModelScope[], at: JsonPath): readonly string[] {
  return scopes.find((scope) => pathEquals(scope.at, at))?.bound ?? [];
}

/**
 * Все чтения `$model(...)`: текстовые части `children` и значения `componentProps` на любой
 * глубине.
 *
 * Шаги мастера (`componentProps.steps`) пропускаются — это узлы, и их обходит {@link walkNodes}
 * своим порядком; второй заход в них отдал бы каждое чтение шага дважды.
 */
export function collectModelReads(schema: JsonFormSchema): readonly ModelRead[] {
  const out: ModelRead[] = [];

  walkNodes(schema, (node, nodePath) => {
    const scope = scopeOfPath(nodePath);
    const push = (within: JsonPath, value: unknown): void => {
      const arg = modelArg(value);
      if (arg !== undefined) out.push({ node, nodePath, within, path: arg, scope });
    };

    const scan = (value: unknown, within: JsonPath): void => {
      if (typeof value === 'string') {
        push(within, value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          scan(item, [...within, index]);
        });
        return;
      }
      if (value !== null && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) scan(item, [...within, key]);
      }
    };

    const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
    if (props !== undefined && props !== null && typeof props === 'object') {
      for (const [key, value] of Object.entries(props)) {
        if (key === 'steps' && Array.isArray(value) && value.some(isNodeLike)) continue;
        scan(value, ['componentProps', key]);
      }
    }

    if (isContainerNode(node) && !isArrayNode(node) && !isFieldNode(node)) {
      (node as JsonContainerNode).children?.forEach((child, index) => {
        if (!isNodeLike(child)) push(['children', index], child);
      });
    }
  });

  return out;
}

/**
 * Объявлен ли путь в области — с терпимостью к вложенности.
 *
 * Точное совпадение отвергало бы законные случаи в обе стороны: `address.city` при объявленном
 * `address` (группа) и `address` при объявленном `address.city` (чтение группы целиком). Правило
 * то же, что у целостности правил формы.
 */
export function isPathBound(path: string, bound: Iterable<string>): boolean {
  for (const known of bound) {
    if (known === path || path.startsWith(`${known}.`) || known.startsWith(`${path}.`)) {
      return true;
    }
  }
  return false;
}
