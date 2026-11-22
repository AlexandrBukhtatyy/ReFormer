/**
 * Поле ReFormer на нейтральной разметке — аналог `FormField` из `@reformer/ui-kit`, но на общем
 * `FieldFrame`. Компонент и его пропсы объявлены в схеме формы (`component` + `componentProps`),
 * в JSX — только `<Field control={form.x} />`.
 *
 * Состояние поля даёт headless-хук `useFormField` из `@reformer/cdk` (значение, первое замечание
 * текстом из `ValidationMessagesProvider`, живой путь поля), диалект контрола — `bindFieldProps`.
 * Путь DOM-контракта — путь поля в модели через дефис (`personalData-lastName`); у поля строки
 * массива он живой и следует за индексом строки (`properties-0-description`,
 * packages/reformer/docs/llms/10-arrays.md, «Путь поля строки — control.path»).
 *
 * `FieldWrapper` — то же для `@reformer/renderer-json`: рендерер сам привязывает контрол и отдаёт
 * его детям обёртки (`FIELD_WRAPPER` реестра) вместе с `testId` из живого пути поля, обёртка
 * добавляет рамку и атрибуты контракта.
 */
import { cloneElement, isValidElement, type ComponentType, type ReactNode } from 'react';
import type { FormControl } from '@reformer/core';
import { bindFieldProps, getFieldAdapter, useFormControl } from '@reformer/core/react';
import { useFormField } from '@reformer/cdk/form-field';
import { Checkbox, ReadonlyValue, type ReadonlyValueProps } from '../../shared/ui/controls';
import { FieldFrame, controlAttrs } from '../../shared/ui/FieldFrame';
import './adapters';

/** Контролы с подписью справа (BENCH-CONTRACT §4). */
const INLINE_LABEL = new Set<unknown>([Checkbox]);

/** Путь поля в модели → путь DOM-контракта: `properties.0.description` → `properties-0-description`. */
const domPath = (path: string): string => path.replace(/\./g, '-');

export function Field<T>({ control }: { control: FormControl<T> }) {
  const { seam, state } = useFormField(control);
  const Component = control.component as ComponentType<Record<string, unknown>>;
  const { label, ...rest } = state.componentProps as { label: string };
  const path = domPath(state.path);
  // Значение — в DOM-элемент (неуправляемые адаптеры, ./adapters.ts): рендер его не читает, и
  // поле на клавишу не перерисовывается.
  const bound = bindFieldProps(getFieldAdapter(Component), seam, rest, Component);
  return (
    <FieldFrame path={path} label={label} error={state.error} inline={INLINE_LABEL.has(Component)}>
      <Component {...bound} {...controlAttrs(path, state.error)} disabled={state.isDisabled} />
    </FieldFrame>
  );
}

/**
 * Вычисляемое поле (цель `compute`): только чтение — компонент схемы (`ReadonlyValue`,
 * `computed-{path}`) получает значение, без контрола и рамки поля.
 */
export function Computed<T>({ control }: { control: FormControl<T> }) {
  const { value, componentProps, path } = useFormControl(control);
  const Component = (control.component ?? ReadonlyValue) as ComponentType<ReadonlyValueProps>;
  const { label } = componentProps as { label: string };
  return (
    <Component path={domPath(path)} label={label} value={value as ReadonlyValueProps['value']} />
  );
}

export interface FieldWrapperProps {
  control: FormControl<unknown>;
  children: ReactNode;
  /** Путь поля через дефис — рендерер выводит его из живого пути поля в модели. */
  testId?: string;
}

export function FieldWrapper({ control, children, testId = '' }: FieldWrapperProps) {
  const { state } = useFormField(control);
  const label = String(state.componentProps.label ?? '');
  const attrs = controlAttrs(testId, state.error);
  return (
    <FieldFrame
      path={testId}
      label={label}
      error={state.error}
      inline={INLINE_LABEL.has(control.component)}
    >
      {isValidElement(children) ? cloneElement(children, attrs) : children}
    </FieldFrame>
  );
}
