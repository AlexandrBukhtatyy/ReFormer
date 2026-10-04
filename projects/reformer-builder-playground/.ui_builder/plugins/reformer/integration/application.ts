/**
 * Билдер с движком ReFormer — состав для интеграционных тестов домена.
 *
 * @module plugins/reformer/integration/application
 */

import { DocumentModelPoint } from '@reformer/builder-plugin-api/internal';
import { fromProfile } from '@/application/composer/compose';
import { builtinProfile } from '@/application/profiles/registry';
import type { ApplicationComposition } from '@/shell/boot/composition';
import { withDomainPlugins, type DomainPlugin } from '../../.shared/application';
import { createAiPlugin } from '../ai/src';
import aiManifest from '../ai/src/manifest.json';
import { createCodegenPlugin } from '../codegen/src';
import codegenManifest from '../codegen/src/manifest.json';
import { createSchemaEditorPlugin } from '../editor/src';
import editorManifest from '../editor/src/manifest.json';
import { createPreviewRuntimePlugin } from '../render/src';
import renderManifest from '../render/src/manifest.json';
import { createTemplatesPlugin } from '../templates/src';
import templatesManifest from '../templates/src/manifest.json';
import { createSchemaValidatorPlugin } from '../validator/src';
import validatorManifest from '../validator/src/manifest.json';

/** Шесть плагинов домена — в том же порядке, в каком их называл прежний профиль билдера. */
export const REFORMER_PLUGINS: readonly DomainPlugin[] = [
  { manifest: validatorManifest, create: () => createSchemaValidatorPlugin({}) },
  {
    manifest: editorManifest,
    create: () => createSchemaEditorPlugin({ modelPoint: DocumentModelPoint }),
  },
  { manifest: renderManifest, create: () => createPreviewRuntimePlugin() },
  { manifest: aiManifest, create: () => createAiPlugin() },
  { manifest: codegenManifest, create: () => createCodegenPlugin() },
  { manifest: templatesManifest, create: () => createTemplatesPlugin() },
];

/** Основа, киты и плагины домена ReFormer. */
export function reformerApplication(): ApplicationComposition {
  return withDomainPlugins(fromProfile(builtinProfile('builder')), REFORMER_PLUGINS);
}
