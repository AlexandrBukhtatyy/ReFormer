import type { ComponentType } from 'react';

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
 * HOC: превращает чистый shadcn-примитив в field-компонент по контракту seam.
 *
 * Под `<FormField control={…}/>` (@reformer/cdk) и в renderer-react компонент получает
 * plain props, резолвленные выше: `value` (raw), value-based `onChange:(value)=>void`,
 * `onBlur`, `disabled`, `id`, `aria-*`, весь `componentProps` кроме `testId`.
 *
 * HOC отбрасывает `control` (renderer-react дополнительно передаёт `control={fieldNode}` — в DOM
 * он не нужен) и любые `strip`-ключи, чтобы ничего не текло в DOM, и маппит value/onChange под
 * event-shape примитива через {@link FieldAdapter}.
 */
export function withFormControl<P extends object>(
  Primitive: ComponentType<P>,
  adapter: FieldAdapter
): ComponentType<Record<string, unknown>> {
  function Field(props: Record<string, unknown>) {
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

    // rest (componentProps + aria/id) идёт первым, bind перекрывает value/onChange под адаптер.
    return <Primitive {...(rest as unknown as P)} {...(bind as Partial<P>)} />;
  }
  Field.displayName = `Field(${Primitive.displayName ?? Primitive.name ?? 'Component'})`;
  return Field;
}
