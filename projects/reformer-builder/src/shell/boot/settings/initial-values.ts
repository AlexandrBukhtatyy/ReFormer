/**
 * Начальные значения и имена операторов схемы НАСТРОЕК плагина — своё, а не из стека ReFormer.
 *
 * ## Почему копия, а не импорт из стека
 *
 * Форма настроек — интерфейс самого билдера: её рисует `renderer-json` компонентами оболочки
 * (`./chrome-registry`), и это та же «своя технология», что `@reformer/ui-kit` в chrome, а не
 * редактируемый домен. Синтез значений в стеке (`form-mock`) решает другую задачу — наполнить
 * форму ЛЮБОГО кита правдоподобными данными — и знает имена компонентов кита. Оболочке нужно
 * меньшее: пути `$model` из схемы с пустыми значениями, по словарю из девяти компонентов chrome.
 *
 * Импорт из стека сделал бы оболочку зависимой от пакета, которого в профиле может не быть
 * (`builder.base`, другой стек). Дублирование в сорок строк принято сознательно
 * (`docs/decisions-log.md`, «ось стека»).
 *
 * @module shell/boot/settings/initial-values
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonContainerNode,
  type JsonFieldNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';

/** Компоненты chrome с булевым значением (см. `CHROME_COMPONENTS`). */
const BOOLEAN_CHROME: ReadonlySet<string> = new Set(['Checkbox', 'Switch']);

function isNodeLike(value: unknown): value is JsonNode {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return 'value' in value || 'array' in value || 'component' in value;
}

function defaultOf(node: JsonFieldNode): unknown {
  const component = parseOperator(node.component)?.arg;
  if (component !== undefined && BOOLEAN_CHROME.has(component)) return false;
  // `null`, а не `''`: пустая строка в числовом поле не проходит проверку типа модели.
  if (node.componentProps?.type === 'number') return null;
  return '';
}

function setNested(target: Record<string, unknown>, segments: string[], value: unknown): void {
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i]!;
    if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  const last = segments[segments.length - 1]!;
  // Первое объявление пути выигрывает: два поля на один путь — это одно значение модели.
  if (!(last in cursor)) cursor[last] = value;
}

/**
 * Значения по всем путям `$model`, которые называет схема.
 *
 * Модель обязана знать ВСЕ пути: иначе рендерер пишет «нет form-node для сигнала» и рисует
 * пустоту вместо поля. В шаблон элемента массива не спускаемся — его пути относительны элементу.
 */
export function initialValuesOf(schema: JsonFormSchema): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const visit = (node: JsonNode): void => {
    if (isArrayNode(node)) {
      const parsed = parseOperator(node.array);
      if (parsed?.op === 'model') setNested(root, parsed.arg.split('.'), []);
      return;
    }
    if (isFieldNode(node)) {
      const parsed = parseOperator(node.value);
      if (parsed?.op === 'model') setNested(root, parsed.arg.split('.'), defaultOf(node));
      return;
    }
    if (isContainerNode(node)) {
      (node as JsonContainerNode).children?.forEach((child) => {
        if (isNodeLike(child)) visit(child);
      });
    }
  };
  if (isNodeLike(schema.root)) visit(schema.root);
  return root;
}

/** Имена, которые схема называет операторами: реестру настроек нужны заглушки под каждое. */
export interface SettingsOperatorNames {
  readonly components: readonly string[];
  readonly dataSources: readonly string[];
  readonly fns: readonly string[];
  readonly locales: readonly string[];
}

export function operatorNamesOf(schema: JsonFormSchema): SettingsOperatorNames {
  const components = new Set<string>();
  const dataSources = new Set<string>();
  const fns = new Set<string>();
  const locales = new Set<string>();

  const scan = (value: unknown): void => {
    if (typeof value === 'string') {
      const parsed = parseOperator(value);
      if (parsed?.op === 'component') components.add(parsed.arg);
      else if (parsed?.op === 'dataSource') dataSources.add(parsed.arg);
      else if (parsed?.op === 'fn') fns.add(parsed.arg);
      else if (parsed?.op === 'locale') locales.add(parsed.arg);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(scan);
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const nested of Object.values(value as Record<string, unknown>)) scan(nested);
    }
  };

  scan(schema.root);
  return {
    components: [...components],
    dataSources: [...dataSources],
    fns: [...fns],
    locales: [...locales],
  };
}
