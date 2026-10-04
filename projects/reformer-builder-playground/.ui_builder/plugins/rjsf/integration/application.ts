/**
 * Билдер с движком RJSF — состав для интеграционных тестов домена.
 *
 * @module plugins/rjsf/integration/application
 */

import { fromProfile } from '@/application/composer/compose';
import { builtinProfile } from '@/application/profiles/registry';
import type { ApplicationComposition } from '@/shell/boot/composition';
import { withDomainPlugins, type DomainPlugin } from '../../.shared/application';
import { createRjsfEditorPlugin } from '../editor/src';
import editorManifest from '../editor/src/manifest.json';
import { createRjsfRenderPlugin } from '../render/src';
import renderManifest from '../render/src/manifest.json';

/** Два плагина домена: редактор и поверхность превью. */
export const RJSF_PLUGINS: readonly DomainPlugin[] = [
  { manifest: editorManifest, create: () => createRjsfEditorPlugin() },
  { manifest: renderManifest, create: () => createRjsfRenderPlugin() },
];

/** Основа, киты и плагины домена RJSF; `base` — состав, поверх которого они встают. */
export function rjsfApplication(
  base: ApplicationComposition = fromProfile(builtinProfile('builder'))
): ApplicationComposition {
  return withDomainPlugins(base, RJSF_PLUGINS);
}
