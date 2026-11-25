/**
 * Пропсы узла схемы: порядок слияния, служебные ключи поля и вывод `testId`. Чистые функции без
 * слоя представления — одни правила для рендереров схемы на любом фреймворке.
 *
 * @module render/node-props
 */

import type { Signal } from '@preact/signals-core';
import { isValueSignal } from '../model/model-signals-proxy';
import type { FieldAdapter } from './field-adapter';

type Props = Readonly<Record<string, unknown>>;

const EMPTY: Props = Object.freeze({});

/**
 * Пропсы узла одним объектом. Приоритет по возрастанию: схема (`componentProps` автора) →
 * реактивные пропсы ноды формы (`updateComponentProps`) → переопределение поведения
 * (`schema.node(selector).patchProps()`). Пока накладывать нечего, возвращается объект схемы — та
 * же ссылка.
 */
export function mergeNodeProps(
  base: Props | undefined,
  own: Props | undefined,
  override: Props | null | undefined
): Props {
  if (own === undefined && override == null) return base ?? EMPTY;
  return { ...base, ...own, ...override };
}

/** Ключи пропсов, значения которых — сигналы ядра (`$model(...)` в `componentProps`). */
export function signalPropKeys(props: Props | undefined): string[] {
  const keys: string[] = [];
  if (props) for (const key of Object.keys(props)) if (isValueSignal(props[key])) keys.push(key);
  return keys;
}

/**
 * Пропсы с сигналами, развёрнутыми в значения: компонент получает значение поля, а не сигнал.
 * Читает сигналы — вызывать там, где чтение отслеживается (эффект, мост сигналов рендерера), чтобы
 * смена значения дошла до компонента. Пропсы без сигналов возвращаются той же ссылкой.
 */
export function unwrapSignalProps(props: Props | undefined): Props | undefined {
  const keys = signalPropKeys(props);
  if (!props || keys.length === 0) return props;
  const out: Record<string, unknown> = { ...props };
  for (const key of keys) out[key] = (props[key] as Signal<unknown>).value;
  return out;
}

/** Служебные ключи поля: их забирает рендерер, контролу они не уходят. */
export interface FieldOwnProps {
  /** Класс обёртки поля. */
  className: string | undefined;
  /** Тег или компонент вокруг контрола, когда обёртки поля нет. */
  wrapper: unknown;
  /** Обёртка этого поля — главнее обёртки из настроек рендерера. */
  fieldWrapper: unknown;
  /** Явный `testId` из схемы. */
  testId: unknown;
  /** Всё остальное — пропсы контрола. */
  rest: Record<string, unknown>;
}

/** Отделить служебные ключи поля от пропсов контрола. */
export function splitFieldProps(props: Props): FieldOwnProps {
  const { className, wrapper, fieldWrapper, testId, ...rest } = props as Record<string, unknown>;
  return {
    className: typeof className === 'string' ? className : undefined,
    wrapper,
    fieldWrapper,
    testId,
    rest,
  };
}

/**
 * `testId` поля: явный из схемы, иначе из живого пути поля в модели — точки заменяются дефисами
 * (`personalData.lastName` → `personalData-lastName`; у поля строки массива — с её текущим
 * индексом). Поле без пути и без явного значения `testId` не получает.
 */
export function fieldTestId(explicit: unknown, path: string): string | undefined {
  if (typeof explicit === 'string') return explicit;
  return path ? path.replace(/\./g, '-') : undefined;
}

/**
 * Нужна ли контролу нода формы пропом `control`: только по явному запросу — `passControl`
 * адаптера либо статика `reformerNeedsControl` компонента.
 */
export function needsControl(adapter: FieldAdapter | undefined, component: unknown): boolean {
  if (adapter?.passControl === true) return true;
  if (component == null || (typeof component !== 'function' && typeof component !== 'object')) {
    return false;
  }
  return (component as { reformerNeedsControl?: unknown }).reformerNeedsControl === true;
}
