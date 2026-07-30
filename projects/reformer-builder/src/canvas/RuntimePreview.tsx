/**
 * Runtime-preview: реальный рендер формы через `@reformer/renderer-json` (спека §9).
 * `buildPreview` (registry ui-kit + модель + форма) → `<JsonRendererProvider>` +
 * `<JsonFormRenderer>`. Сборка в try/catch (битая схема → fallback), рендер — под error boundary.
 *
 * @module reformer-builder/canvas/RuntimePreview
 */

import { useMemo } from 'react';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { FormProxy } from '@reformer/core';
import {
  buildPreview,
  WizardFormProvider,
  type MockData,
  type PreviewBundle,
} from '../preview-runtime';
import { PreviewErrorBoundary } from './ErrorBoundary';

export function RuntimePreview({ schema, mock }: { schema: JsonFormSchema; mock?: MockData }) {
  // Пересобираем registry+model+form при смене схемы ИЛИ мока (иммутабельность → новая ссылка).
  // Ввод в поля меняет только сигналы модели (identity schema/mock стабильна) — фокус не теряется.
  const built = useMemo(():
    | { bundle: PreviewBundle; error: null }
    | { bundle: null; error: string } => {
    try {
      return { bundle: buildPreview(schema, mock), error: null };
    } catch (e) {
      return { bundle: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [schema, mock]);

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
      <JsonRendererProvider
        settings={{ registry: built.bundle.registry, model: built.bundle.model }}
      >
        <WizardFormProvider form={built.bundle.form as FormProxy<Record<string, unknown>>}>
          <JsonFormRenderer schema={schema} validate={false} />
        </WizardFormProvider>
      </JsonRendererProvider>
    </PreviewErrorBoundary>
  );
}
