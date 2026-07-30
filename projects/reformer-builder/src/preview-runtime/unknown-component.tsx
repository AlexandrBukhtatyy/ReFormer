/**
 * Плейсхолдеры компонентов для Runtime-preview (спека §13 риск #5, §14 «неизвестный компонент →
 * generic box»). Два намерения:
 *
 * - {@link makeUnknownComponent} — ТРЕВОЖНЫЙ amber-warning «не зарегистрирован в preview».
 *   Достижим только для реально не-каталожных `$component` из ручного JSON (детект в `unknown.ts`).
 * - {@link makePreviewLimitedComponent} — НЕЙТРАЛЬНЫЙ стаб «предпросмотр ограничен» для компонентов,
 *   которые каталог знает, но canvas не рисует точно (оверлеи/subpath-only — см. `render-policy.ts`).
 *
 * Оба рендерят детей, чтобы вложенная структура оставалась видна.
 *
 * @module reformer-builder/preview-runtime/unknown-component
 */

import type { ComponentType, ReactNode } from 'react';

/** Фабрика amber-плейсхолдера для НЕИЗВЕСТНОГО каталогу имени `name`. */
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

/**
 * Фабрика НЕЙТРАЛЬНОГО стаба «предпросмотр ограничен» для каталожного компонента, который canvas
 * не может отрисовать точно (оверлей / subpath-only). Без amber-warning: компонент известен
 * каталогу и палитре — просто не рендерится живьём здесь (точность — на dev-сервере, §13).
 */
export function makePreviewLimitedComponent(
  name: string,
  reason?: string
): ComponentType<{ children?: ReactNode }> {
  function PreviewLimitedComponent({ children }: { children?: ReactNode }) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <span className="font-mono text-foreground">{name}</span>
        <span className="ml-2">— предпросмотр ограничен{reason ? ` (${reason})` : ''}</span>
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    );
  }
  PreviewLimitedComponent.displayName = `PreviewLimited(${name})`;
  return PreviewLimitedComponent;
}
