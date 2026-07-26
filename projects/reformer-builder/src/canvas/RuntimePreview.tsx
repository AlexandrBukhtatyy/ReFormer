/**
 * Runtime-preview: реальный рендер формы через `@reformer/renderer-json` (спека §9).
 * `buildPreview` (registry ui-kit + модель + форма) → `<JsonRendererProvider>` +
 * `<JsonFormRenderer>`. Сборка в try/catch (битая схема → fallback), рендер — под error boundary.
 *
 * @module reformer-builder/canvas/RuntimePreview
 */

import { useMemo } from 'react';
import { JsonFormRenderer, JsonRendererProvider, type JsonFormSchema } from '@reformer/renderer-json';
import { buildPreview, type PreviewBundle } from '../preview-runtime';
import { PreviewErrorBoundary } from './ErrorBoundary';

export function RuntimePreview({ schema }: { schema: JsonFormSchema }) {
  // Пересобираем registry+model+form при смене ссылки схемы (иммутабельность → новая ссылка на правку).
  const built = useMemo((): { bundle: PreviewBundle; error: null } | { bundle: null; error: string } => {
    try {
      return { bundle: buildPreview(schema), error: null };
    } catch (e) {
      return { bundle: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [schema]);

  if (built.error !== null) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <div className="font-medium">Схема не сконвертировалась</div>
        <div className="mt-1 font-mono text-xs opacity-80">{built.error}</div>
      </div>
    );
  }

  return (
    <PreviewErrorBoundary resetKey={schema}>
      <JsonRendererProvider settings={{ registry: built.bundle.registry, model: built.bundle.model }}>
        <JsonFormRenderer schema={schema} validate={false} />
      </JsonRendererProvider>
    </PreviewErrorBoundary>
  );
}
