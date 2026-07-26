/**
 * Плейсхолдер незарегистрированного `$component(NAME)` для Runtime-preview (спека §13 риск #5,
 * §14 «неизвестный компонент → generic box»). Рендерит рамку с именем и, если есть, детей —
 * чтобы вложенная структура всё равно была видна.
 *
 * @module reformer-builder/preview-runtime/unknown-component
 */

import type { ComponentType, ReactNode } from 'react';

/** Фабрика плейсхолдер-компонента для имени `name`. */
export function makeUnknownComponent(name: string): ComponentType<{ children?: ReactNode }> {
  function UnknownComponent({ children }: { children?: ReactNode }) {
    return (
      <div className="rounded-md border border-dashed border-amber-400/60 bg-amber-50/40 p-3 text-xs dark:bg-amber-950/20">
        <span className="font-mono text-amber-700 dark:text-amber-400">⚠ {name}</span>
        <span className="ml-2 text-muted-foreground">— компонент не зарегистрирован в preview</span>
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    );
  }
  UnknownComponent.displayName = `Unknown(${name})`;
  return UnknownComponent;
}
