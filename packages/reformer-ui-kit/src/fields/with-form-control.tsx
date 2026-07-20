import { forwardRef, useImperativeHandle, useRef } from 'react';
import type {
  ComponentType,
  ForwardRefExoticComponent,
  Ref,
  RefAttributes,
  RefObject,
} from 'react';
import { type FieldHandle, makeElementFieldHandle } from './field-handle';

/**
 * Адаптер поля: описывает, как разный event-shape shadcn-примитива
 * (`value`/`onChange`, `checked`/`onCheckedChange`, `value`/`onValueChange`, …)
 * сводится к value-based контракту ReFormer-формы — `value` + `onChange(value)` + `onBlur`.
 *
 * Один адаптер = один event-shape. Экзотический контроль, не выразимый через эти поля,
 * — стоп-условие playbook (эскалация к оркестратору), а не «ещё один хак в HOC».
 */
export interface FieldAdapter {
  /** Проп, из которого примитив читает значение: `'value'` | `'checked'` | `'pressed'` | `'selected'`. */
  valueProp: string;
  /** Колбэк, через который примитив эмитит: `'onChange'` | `'onCheckedChange'` | `'onValueChange'` | … */
  changeProp: string;
  /** emit примитива → значение поля (`e.target.value`, `checked` bool, `number[]`→number, …). */
  fromEmit: (arg: unknown, rest: Record<string, unknown>) => unknown;
  /** значение поля → `valueProp` примитива (+ coerce `null`/`undefined`). */
  toValue: (value: unknown) => unknown;
  /**
   * Проброс blur. По умолчанию `onBlur` пробрасывается как есть. Некоторым контролам нужен
   * другой канал (напр. Select мапит blur на `onOpenChange(false)`).
   */
  bindBlur?: (onBlur: (() => void) | undefined) => Record<string, unknown>;
  /** Доп. ключи убрать перед спредом в примитив (помимо всегда снимаемых `control`/`value`/`onChange`/`onBlur`). */
  strip?: string[];
}

/**
 * Опции handle-слоя HOC (см. docs/plans/useimperativehandle-refactored-blossom.md).
 */
export interface WithFormControlOptions<H extends FieldHandle = FieldHandle> {
  /**
   * Композит сам реализует императивный handle (`useImperativeHandle`). Тогда ref потребителя
   * форвардится ПРЯМО в примитив (passthrough), а HOC не вешает свой `useImperativeHandle` —
   * иначе один ref писался бы дважды (последний писатель побеждает).
   */
  exposesHandle?: boolean;
  /** Переопределить baseline-handle. По умолчанию — {@link makeElementFieldHandle} из DOM-узла примитива. */
  buildHandle?: (el: RefObject<HTMLElement | null>) => H;
}

/**
 * Разбирает props поля на `rest` (спред в примитив) и `bind` (value/onChange/onBlur под
 * event-shape примитива через {@link FieldAdapter}). Логика идентична прежней реализации HOC.
 */
function bindField(
  props: Record<string, unknown>,
  adapter: FieldAdapter
): { rest: Record<string, unknown>; bind: Record<string, unknown> } {
  // `control` (renderer-путь) и value/onChange/onBlur вынимаются из спреда в примитив.
  const { value, onChange, onBlur, control: _control, ...rest } = props;
  void _control;
  for (const key of adapter.strip ?? []) delete rest[key];

  const emit = onChange as ((v: unknown) => void) | undefined;
  const bind: Record<string, unknown> = {
    [adapter.valueProp]: adapter.toValue(value),
    [adapter.changeProp]: (arg: unknown) => emit?.(adapter.fromEmit(arg, rest)),
    ...(adapter.bindBlur ? adapter.bindBlur(onBlur as (() => void) | undefined) : { onBlur }),
  };
  return { rest, bind };
}

/**
 * HOC: превращает чистый shadcn-примитив в field-компонент по контракту seam.
 *
 * Под `<FormField control={…}/>` (@reformer/cdk) и в renderer-react компонент получает
 * plain props, резолвленные выше: `value` (raw), value-based `onChange:(value)=>void`,
 * `onBlur`, `disabled`, `id`, `aria-*`, весь `componentProps` кроме `testId`.
 *
 * HOC отбрасывает `control` (renderer-react дополнительно передаёт `control={fieldNode}` — в DOM
 * он не нужен) и любые `strip`-ключи, чтобы ничего не текло в DOM, и маппит value/onChange под
 * event-shape примитива через {@link FieldAdapter}.
 *
 * Компонент — `forwardRef` и экспонирует императивный {@link FieldHandle}: по умолчанию baseline
 * (focus/blur/scrollIntoView/getElement из DOM-узла примитива), либо handle композита при
 * `options.exposesHandle`. Ref достаётся из render-схемы через `schema.node(sel).getRef()`.
 */
export function withFormControl<P extends object, H extends FieldHandle = FieldHandle>(
  Primitive: ComponentType<P>,
  adapter: FieldAdapter,
  options?: WithFormControlOptions<H>
): ForwardRefExoticComponent<Record<string, unknown> & RefAttributes<H>> {
  // Примитивы v7 — React-19 ref-as-prop plain-функции: ref, попавший в props, долетает до DOM.
  // TS этого не знает (ComponentType<P> без ref), поэтому локально расширяем сигнатуру.
  const RefPrimitive = Primitive as ComponentType<P & { ref?: Ref<unknown> }>;

  // Passthrough: композит владеет handle → форвардим ref потребителя прямо в примитив.
  const PassthroughField = forwardRef<H, Record<string, unknown>>(function Field(props, ref) {
    const { rest, bind } = bindField(props, adapter);
    return <RefPrimitive ref={ref} {...(rest as unknown as P)} {...(bind as Partial<P>)} />;
  });

  // Baseline: примитив пишет свой DOM-узел в elRef, из него синтезируем FieldHandle.
  const BaselineField = forwardRef<H, Record<string, unknown>>(function Field(props, ref) {
    const elRef = useRef<HTMLElement | null>(null);
    useImperativeHandle(
      ref,
      () => options?.buildHandle?.(elRef) ?? (makeElementFieldHandle(elRef) as H),
      []
    );
    const { rest, bind } = bindField(props, adapter);
    return <RefPrimitive ref={elRef} {...(rest as unknown as P)} {...(bind as Partial<P>)} />;
  });

  // rest (componentProps + aria/id) идёт первым, bind перекрывает value/onChange под адаптер.
  const Field = options?.exposesHandle ? PassthroughField : BaselineField;
  Field.displayName = `Field(${Primitive.displayName ?? Primitive.name ?? 'Component'})`;
  return Field;
}
