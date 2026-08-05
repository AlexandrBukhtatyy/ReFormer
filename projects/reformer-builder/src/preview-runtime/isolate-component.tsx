/**
 * Изоляция компонента в Runtime-preview: падение одного контрола не должно гасить всю форму.
 * Каждый компонент реестра оборачивается в error boundary — упавший узел показывает компактную
 * плашку с именем и текстом ошибки, СОХРАНЯЯ `className` (а с ним класс-токен узла), поэтому
 * остаётся выделяемым и целью drag-drop; всё остальное дерево продолжает рендериться.
 *
 * Обёртка не добавляет DOM в успешном пути (рендерит компонент как есть) и переносит на себя
 * контракты-статики, по которым рендерер и ui-kit распознают компонент:
 * `__selfManagedChildren` (сам рендерит детей), `reformerNeedsControl` (получает form-node),
 * `reformerLayout` (inline-подпись у Checkbox/Switch — иначе подпись задвоится).
 *
 * @module reformer-builder/preview-runtime/isolate-component
 */

import { Component, type ComponentType, type ReactNode } from 'react';

/** Статики-контракты, которые обязаны пережить обёртку. */
const CONTRACT_STATICS = [
  '__selfManagedChildren',
  'reformerNeedsControl',
  'reformerLayout',
] as const;

interface BoundaryProps {
  name: string;
  className?: string;
  children: ReactNode;
}

class ComponentErrorBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        // className несёт класс-токен узла — без него упавший узел выпал бы из выделения и DnD.
        className={`rounded-md border border-dashed border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive ${this.props.className ?? ''}`}
      >
        <span className="font-mono font-semibold">⚠ {this.props.name}</span>
        <span className="ml-2 opacity-80">— компонент упал при рендере</span>
        <div className="mt-1 font-mono text-[11px] opacity-70">{error.message}</div>
      </div>
    );
  }
}

/** Обернуть компонент реестра превью в персональный error boundary. */
export function isolateComponent<P extends { className?: string }>(
  Comp: ComponentType<P>,
  name: string
): ComponentType<P> {
  function Isolated(props: P) {
    return (
      <ComponentErrorBoundary name={name} className={props.className}>
        <Comp {...props} />
      </ComponentErrorBoundary>
    );
  }
  Isolated.displayName = `Isolated(${name})`;
  for (const key of CONTRACT_STATICS) {
    const value = (Comp as unknown as Record<string, unknown>)[key];
    if (value !== undefined) (Isolated as unknown as Record<string, unknown>)[key] = value;
  }
  return Isolated as ComponentType<P>;
}
