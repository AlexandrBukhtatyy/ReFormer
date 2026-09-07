/**
 * Плейсхолдеры компонентов и изоляция падений.
 *
 * Три разных сообщения, и разница между ними принципиальна для человека, который смотрит
 * на превью и решает, что чинить:
 *
 * - {@link makeUnknownComponent} — ТРЕВОЖНОЕ «имени нет в каталоге». Достижимо только для
 *   `$component(...)` из схемы, написанной руками: палитра такого предложить не может.
 * - {@link makeLimitedComponent} — НЕЙТРАЛЬНОЕ «предпросмотр ограничен». Каталог имя знает,
 *   просто вживую его рисовать нельзя (оверлей без триггера, компонент за subpath).
 * - {@link isolateComponent} — «компонент упал при рендере». Это уже поломка, и она обязана
 *   быть локальной: падение одного контрола не должно гасить всю форму.
 *
 * Все три СОХРАНЯЮТ `className` — а с ним класс-токен узла. Без этого упавший или
 * незарегистрированный узел выпал бы из выбора кликом, то есть чинить его пришлось бы,
 * не имея возможности на него нажать.
 *
 * @module plugins/preview/runtime/stubs
 */

import { Component, type ComponentType, type ReactNode } from 'react';

/** Пропсы плейсхолдера: дети плюс класс-токен узла. */
interface PlaceholderProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Статики-контракты, которые обязаны пережить обёртку.
 *
 * По ним рендерер и кит узнают компонент: сам ли он рисует детей, нужен ли ему form-node,
 * рисовать ли подпись рядом. Потеряй обёртка любой из них — подпись у Checkbox задвоилась бы,
 * а поле осталось бы без сигнала.
 */
const CONTRACT_STATICS: readonly string[] = [
  '__selfManagedChildren',
  'reformerNeedsControl',
  'reformerLayout',
];

/** Тревожный плейсхолдер для имени, которого нет в каталоге. */
export function makeUnknownComponent(name: string): ComponentType<PlaceholderProps> {
  function UnknownComponent({ children, className }: PlaceholderProps): ReactNode {
    return (
      <div
        className={`rounded-md border border-dashed border-amber-400/60 bg-amber-50/40 p-3 text-xs dark:bg-amber-950/20 ${className ?? ''}`}
      >
        <span className="font-mono text-amber-700 dark:text-amber-400">{name}</span>
        <span className="text-muted-foreground ml-2">— компонента нет в каталоге кита</span>
        {children === undefined ? null : <div className="mt-2">{children}</div>}
      </div>
    );
  }
  UnknownComponent.displayName = `Unknown(${name})`;
  return UnknownComponent;
}

/** Нейтральный стаб для каталожного компонента, который вживую рисовать нельзя. */
export function makeLimitedComponent(
  name: string,
  reason?: string
): ComponentType<PlaceholderProps> {
  function LimitedComponent({ children, className }: PlaceholderProps): ReactNode {
    return (
      <div
        className={`border-border bg-muted/30 text-muted-foreground rounded-md border border-dashed p-3 text-xs ${className ?? ''}`}
      >
        <span className="text-foreground font-mono">{name}</span>
        <span className="ml-2">
          — предпросмотр ограничен{reason === undefined ? '' : ` (${reason})`}
        </span>
        {children === undefined ? null : <div className="mt-2">{children}</div>}
      </div>
    );
  }
  LimitedComponent.displayName = `Limited(${name})`;
  return LimitedComponent;
}

interface BoundaryProps {
  name: string;
  className?: string;
  children: ReactNode;
}

/**
 * Персональная граница ошибок компонента.
 *
 * Класс, а не хук: границ ошибок функциональными компонентами React не выражает, и это
 * единственное место в плагине, где класс оправдан.
 */
class ComponentBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return (
      <div
        className={`border-destructive/50 bg-destructive/5 text-destructive rounded-md border border-dashed p-3 text-xs ${this.props.className ?? ''}`}
      >
        <span className="font-mono font-semibold">{this.props.name}</span>
        <span className="ml-2 opacity-80">— компонент упал при рендере</span>
        <div className="mt-1 font-mono text-[11px] opacity-70">{error.message}</div>
      </div>
    );
  }
}

/** Обернуть компонент реестра в персональную границу ошибок. */
export function isolateComponent(
  component: unknown,
  name: string
): ComponentType<PlaceholderProps> {
  const Inner = component as ComponentType<Record<string, unknown>>;
  function Isolated(props: PlaceholderProps): ReactNode {
    return (
      <ComponentBoundary name={name} className={props.className}>
        <Inner {...(props as Record<string, unknown>)} />
      </ComponentBoundary>
    );
  }
  Isolated.displayName = `Isolated(${name})`;
  const source = component as Record<string, unknown>;
  const target = Isolated as unknown as Record<string, unknown>;
  for (const key of CONTRACT_STATICS) {
    const value = source[key];
    if (value !== undefined) target[key] = value;
  }
  return Isolated;
}
