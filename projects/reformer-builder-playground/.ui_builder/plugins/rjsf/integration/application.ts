/**
 * Билдер с движком RJSF — состав для интеграционных тестов домена.
 *
 * @module plugins/rjsf/integration/application
 */

import type { ApplicationComposition } from '@/shell/boot/composition';
import { withDomainPlugins, type DomainPlugin } from '../../.shared/application';
import { formsApplication } from '../../forms/integration/application';
import { createRjsfEditorPlugin } from '../editor/src';
import editorManifest from '../editor/src/manifest.json';
import { createRjsfRenderPlugin } from '../render/src';
import renderManifest from '../render/src/manifest.json';

/** Два плагина домена: редактор и поверхность превью. */
export const RJSF_PLUGINS: readonly DomainPlugin[] = [
  { manifest: editorManifest, create: () => createRjsfEditorPlugin() },
  { manifest: renderManifest, create: () => createRjsfRenderPlugin() },
];

/**
 * Встроенные, платформа форм и плагины домена RJSF; `base` — состав, поверх которого они встают.
 * По умолчанию это стенд домена forms: киты и превью-хост — плагины, а не встроенные.
 */
export function rjsfApplication(
  base: ApplicationComposition = formsApplication()
): ApplicationComposition {
  return withDomainPlugins(base, RJSF_PLUGINS);
}
