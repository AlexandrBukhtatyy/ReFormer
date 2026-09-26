/**
 * Поверхность превью домена RJSF: форма react-jsonschema-form компонентами активного кита.
 *
 * Берётся за документ по провайдеру модели (`rjsf.form`), а не по медиатипу. Модель приходит
 * `unknown` — контракт превью общий для стеков, — и форма сужает её сама (`isRjsfForm`).
 *
 * Свой корень React, а не портал в дерево оболочки: падение компонента кита не должно уронить
 * приложение. Снятие в два хода, как у `mountReact` рендера ReFormer: свой элемент уходит из DOM
 * сразу — следующая поверхность встаёт на чистое место, — а корень размонтируется микрозадачей:
 * синхронный `unmount` из очистки эффекта того, кто показывает поверхность, React запрещает.
 *
 * @module plugins/rjsf/render/surface
 */

import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RJSF_PROVIDER_ID } from '@/plugins/rjsf/core';
import type { DocumentRef, KitsService, PreviewSurface } from '@reformer/builder-plugin-api';
import { RJSF_SURFACE_ID } from './contract';

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** RJSF, валидатор и тема — ленивым чанком: нужны только тому, кто открыл форму. */
const RjsfPreview = lazy(() => import('./ui/RjsfPreview'));

export interface RjsfSurfaceDeps {
  readonly t: Translate;
  /** Служба китов, если кит есть в составе. Спрашивается на каждое монтирование. */
  readonly kits: () => KitsService | undefined;
}

export function createRjsfSurface({ t, kits }: RjsfSurfaceDeps): PreviewSurface {
  return {
    id: RJSF_SURFACE_ID,
    title: () => t('surface.title'),
    applies: (doc: DocumentRef) => doc.providerId === RJSF_PROVIDER_ID,
    capabilities: {
      interactive: true,
      hitTest: false,
      dragSource: false,
      executesCode: false,
      sameRealm: true,
    },
    mount(host, ctx) {
      const service = kits();
      const element = document.createElement('div');
      element.style.display = 'contents';
      host.append(element);
      const root = createRoot(element);
      root.render(
        <Suspense
          fallback={<p className="p-4 text-sm text-muted-foreground">{t('surface.loading')}</p>}
        >
          <RjsfPreview ctx={ctx} kits={service} frame={service?.Frame ?? null} t={t} />
        </Suspense>
      );
      return {
        dispose(): void {
          element.remove();
          queueMicrotask(() => {
            root.unmount();
          });
        },
      };
    },
  };
}
