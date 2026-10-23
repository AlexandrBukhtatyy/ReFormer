/**
 * Состав приложения с плагинами домена forms — для интеграционных тестов.
 *
 * Киты, превью-хост и ассистент — платформа форм: ими пользуются оба движка (ReFormer и RJSF), поэтому
 * стенды доменов-движков строят свой состав ПОВЕРХ этого. В приложении их поднимает слой
 * плагинов приложения; здесь они встают в состав тем же способом, что встроенные
 * (`.shared/application`).
 *
 * @module plugins/forms/integration/application
 */

import type { ApplicationComposition } from '@/shell/boot/composition';
import { withDomainPlugins, type DomainPlugin } from '../../.shared/application';
import { baseApplication } from '../../base/integration/application';
import { createAiPlugin } from '../ai/src';
import aiManifest from '../ai/src/manifest.json';
import { createKitsPlugin } from '../kits/src';
import kitsManifest from '../kits/src/manifest.json';
import { createPreviewPlugin } from '../preview/src';
import previewManifest from '../preview/src/manifest.json';

/** Плагины домена — по пакету на плагин. */
export const FORMS_PLUGINS: readonly DomainPlugin[] = [
  { manifest: kitsManifest, create: () => createKitsPlugin({}) },
  { manifest: previewManifest, create: () => createPreviewPlugin() },
  { manifest: aiManifest, create: () => createAiPlugin() },
];

/**
 * Состав приложения с платформой форм.
 *
 * @param base на чём строить; по умолчанию — встроенные и домен base (дерево файлов, панель
 *   проблем): платформа форм и движки вносят свои пункты в его подменю.
 */
export function formsApplication(
  base: ApplicationComposition = baseApplication()
): ApplicationComposition {
  return withDomainPlugins(base, FORMS_PLUGINS);
}
