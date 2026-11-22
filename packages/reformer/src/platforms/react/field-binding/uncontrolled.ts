/**
 * Неуправляемая привязка нативного контрола: значение поля доходит до DOM-элемента без рендера
 * React. Ввод пользователя пишет в поле через `changeProp` адаптера, как и в управляемой привязке, а
 * запись в поле извне (`setValue`, `reset`, цель `computeFrom`) — прямо в DOM-свойство элемента.
 * Компонент поля, который не читает `value` при рендере, на клавишу не перерисовывается.
 *
 * @module platforms/react/field-binding/uncontrolled
 */

import { effect, type ReadonlySignal } from '@preact/signals-core';
import type { FieldAdapter } from './field-adapter';

/** Источник значения неуправляемой привязки — нода поля формы (`FormControl`). */
export interface FieldValueSource {
  readonly value: ReadonlySignal<unknown>;
}

/** Элемент формы, которому привязка пишет значение. */
type FormElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

type FieldRef = (element: Element | null) => (() => void) | undefined;

/** Подписка на значение поля: слушатель вызывается на каждую смену; возвращает отписку. */
type ValueWatch = (listener: (value: unknown) => void) => () => void;

/**
 * Привязка ноды: ссылка `ref` стабильна между рендерами. Адаптер и прочие props — последнего
 * рендера; другой адаптер (компонент поля сменился) заводит новую привязку.
 */
interface Binding {
  readonly ref: FieldRef;
  readonly adapter: FieldAdapter;
  /** Прочие props контрола — их получает `fromEmit` адаптера. */
  rest: Record<string, unknown>;
  /**
   * Значение, отданное элементу пропом `defaultValue` / `defaultChecked` последнего рендера, либо
   * {@link NOT_RENDERED}. Подключённый элемент его уже показывает — первая сверка не нужна.
   */
  rendered: unknown;
  /** Подписка хука на значение поля последнего рендера; без неё — свой effect на элемент. */
  watch: ValueWatch | undefined;
  /** Подключённые элементы и снятие их синхронизации; несколько — у радиогруппы. */
  readonly attached: Map<FormElement, () => void>;
}

const bindings = new WeakMap<FieldValueSource, Binding>();

/** Начальное значение пропом не отдавалось — элемент сверяется при подключении. */
export const NOT_RENDERED: unique symbol = Symbol('reformer.uncontrolled.not-rendered');

const identity = (x: unknown): unknown => x;

/**
 * Записать значение поля в элемент, если элемент показывает другое. Сравнивается прочитанное из
 * элемента (как из события ввода), а не строка: ввод `5.` числового поля разбирается в `5`, совпадает
 * со значением поля и не перетирается — как и отформатированный маской текст, и позиция курсора.
 */
function write(element: FormElement, value: unknown, binding: Binding): void {
  const { adapter } = binding;
  const shown = (adapter.toValue ?? identity)(value);
  if (element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'radio') {
    // Радиокнопка группы: отмечена та, чьё значение — значение поля.
    const radio = element as HTMLInputElement;
    const checked = shown != null && radio.value === String(shown);
    if (radio.checked !== checked) radio.checked = checked;
    return;
  }
  try {
    const fromEmit = adapter.fromEmit ?? identity;
    if (Object.is(fromEmit({ target: element, currentTarget: element }, binding.rest), value)) {
      return;
    }
  } catch {
    // Адаптер не умеет читать элемент вне события — сравниваем то, что показано.
  }
  const prop = (adapter.valueProp ?? 'value') as 'value' | 'checked';
  const next = prop === 'checked' ? Boolean(shown) : String(shown ?? '');
  if ((element as HTMLInputElement)[prop] !== next) {
    (element as unknown as Record<string, unknown>)[prop] = next;
  }
}

/**
 * Передать элемент чужому `ref` из прочих props контрола (ручка поля у обёртки) — привязка занимает
 * `ref` элемента сама. Возвращает отключение.
 */
function forward(ref: unknown, element: Element): (() => void) | undefined {
  if (typeof ref === 'function') {
    const cleanup: unknown = ref(element);
    return typeof cleanup === 'function' ? (cleanup as () => void) : () => ref(null);
  }
  if (ref !== null && typeof ref === 'object' && 'current' in ref) {
    const object = ref as { current: unknown };
    object.current = element;
    return () => {
      if (object.current === element) object.current = null;
    };
  }
  return undefined;
}

function createBinding(source: FieldValueSource, adapter: FieldAdapter): Binding {
  const attached = new Map<FormElement, () => void>();
  const detach = (element: FormElement): void => {
    attached.get(element)?.();
    attached.delete(element);
  };
  const binding: Binding = {
    adapter,
    rest: {},
    rendered: NOT_RENDERED,
    watch: undefined,
    attached,
    ref: (element) => {
      if (element === null) {
        // React 18 не говорит, какой элемент отключён: снимаем ушедшие из документа, когда
        // фиксация закончится.
        queueMicrotask(() => {
          for (const known of [...attached.keys()]) if (!known.isConnected) detach(known);
        });
        return undefined;
      }
      const target = element as FormElement;
      if (!attached.has(target)) {
        const stop = follow(target, source, binding);
        const release = forward(binding.rest.ref, target);
        attached.set(target, () => {
          stop();
          release?.();
        });
      }
      return () => detach(target);
    },
  };
  return binding;
}

/**
 * Следить за значением поля и писать его в элемент; у списка — ещё и за его опциями. Элемент
 * смонтирован с начальным значением рендера — сверка с ним не нужна.
 */
function follow(target: FormElement, source: FieldValueSource, binding: Binding): () => void {
  const stop = subscribe(target, source, binding);
  if (target.tagName !== 'SELECT' || typeof MutationObserver === 'undefined') return stop;
  // Список без значения поля среди опций показывает пустой выбор, а `defaultValue` React
  // применяет только при монтировании: опции, пришедшие позже (справочник), выбор не вернут.
  // Сверяем выбор при каждой смене опций — один раз на пачку записей микрозадачи.
  //
  // Наблюдатель — свой у списка и отключается вместе с привязкой: снять наблюдение с одного
  // элемента `MutationObserver` не умеет, и общий наблюдатель копил бы все когда-либо привязанные
  // списки. Браузер держит наблюдаемые узлы слабо, а DOM-реализации тестов (happy-dom) — сильно:
  // там общий наблюдатель держал размонтированные списки с их поддеревом [ReFormer-2o1j.23].
  const observer = new MutationObserver(() => write(target, source.value.peek(), binding));
  observer.observe(target, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    stop();
  };
}

/** Подписаться на значение поля: слушатель на подписке хука (`watch`) либо свой effect. */
function subscribe(target: FormElement, source: FieldValueSource, binding: Binding): () => void {
  const { watch } = binding;
  if (watch !== undefined) {
    const value = source.value.peek();
    if (!Object.is(value, binding.rendered)) write(target, value, binding);
    return watch((next) => write(target, next, binding));
  }
  // Запись в DOM чтений сигналов не делает: подписка effect — только значение поля.
  let first = true;
  return effect(() => {
    const value = source.value.value;
    // Элемент смонтирован с начальным значением этого рендера: сверять нечего.
    if (first) {
      first = false;
      if (Object.is(value, binding.rendered)) return;
    }
    write(target, value, binding);
  });
}

/**
 * Ссылка `ref` неуправляемой привязки: подключённый элемент получает значение поля и следует за его
 * сменами. Стабильна для ноды, поэтому React не переподключает её на каждом рендере. `rest.ref`
 * (ручка поля у обёртки) получает элемент от неё.
 *
 * Отключение — и cleanup-функцией (React 19), и вызовом с `null` (React 18): тогда снимаются
 * элементы, которых уже нет в документе.
 *
 * @internal
 */
export function uncontrolledRef(
  source: FieldValueSource,
  adapter: FieldAdapter,
  rest: Record<string, unknown>,
  rendered: unknown = NOT_RENDERED,
  watch?: ValueWatch
): FieldRef {
  let binding = bindings.get(source);
  if (binding === undefined || binding.adapter !== adapter) {
    bindings.set(source, (binding = createBinding(source, adapter)));
  }
  binding.rest = rest;
  binding.rendered = rendered;
  binding.watch = watch;
  return binding.ref;
}
