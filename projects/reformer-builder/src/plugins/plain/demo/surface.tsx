/**
 * Поверхность превью демо-стека: форма нативными элементами, без рендерера и без кита.
 *
 * Берётся за документ по провайдеру модели (`plain.form`), а не по медиатипу. Модель приходит
 * `unknown` — контракт превью общий для стеков, — и поверхность сужает её сама (`isPlainForm`).
 *
 * Введённые значения поверхность отдаёт на хранение хосту превью (`keepValues`): переход между
 * видами и пересборка не должны стирать то, что человек напечатал.
 *
 * @module plugins/plain/demo/surface
 */

import { createRoot } from 'react-dom/client';
import type { DocumentRef, PreviewSurface } from '@reformer/builder-plugin-api';
import { PLAIN_PROVIDER_ID, PLAIN_SURFACE_ID } from './contract';
import { NativeForm } from './ui/NativeForm';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export function createNativeSurface(t: Translate): PreviewSurface {
  return {
    id: PLAIN_SURFACE_ID,
    title: () => t('surface.title'),
    applies: (doc: DocumentRef) => doc.providerId === PLAIN_PROVIDER_ID,
    capabilities: {
      interactive: true,
      hitTest: false,
      dragSource: false,
      executesCode: false,
      sameRealm: true,
    },
    mount(host, ctx) {
      // Свой элемент на каждое монтирование: снятие отложено (ниже), и повторный `mount` в тот же
      // `host` — StrictMode делает его сразу — иначе встретил бы ещё живой корень React.
      const element = document.createElement('div');
      host.append(element);
      const root = createRoot(element);
      root.render(<NativeForm ctx={ctx} t={t} />);
      return {
        dispose(): void {
          // Размонтирование — после текущей отрисовки: снимают поверхность из эффекта того,
          // кто её показывает, и синхронный `unmount` внутри рендера React запрещает.
          queueMicrotask(() => {
            root.unmount();
            element.remove();
          });
        },
      };
    },
  };
}
