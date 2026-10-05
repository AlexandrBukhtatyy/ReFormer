/**
 * Состав приложения с плагинами домена base — для интеграционных тестов.
 *
 * Дерево файлов, панель проблем, редактор кода и предпросмотр markdown — то, без чего
 * на оболочке нечем работать с проектом, но оболочке они не принадлежат: это плагины
 * приложения. В приложении их поднимает слой плагинов приложения; здесь они встают в состав тем же способом, что встроенные
 * (`.shared/application`). Стенды остальных доменов строят свой состав ПОВЕРХ этого: платформа
 * форм и движки рассчитывают на дерево проекта и подменю «Сгенерировать», которые вносит base.
 *
 * @module plugins/base/integration/application
 */

import { fromProfile } from '@/application/composer/compose';
import { builtinProfile } from '@/application/profiles/registry';
import type { ApplicationComposition } from '@/shell/boot/composition';
import { withDomainPlugins, type DomainPlugin } from '../../.shared/application';
import { createMarkdownPlugin } from '../markdown-editor/src';
import markdownManifest from '../markdown-editor/src/manifest.json';
import { createFilesPlugin } from '../files/src';
import filesManifest from '../files/src/manifest.json';
import { createMonacoEditorPlugin } from '../monaco-editor/src';
import monacoManifest from '../monaco-editor/src/manifest.json';

/** Плагины домена — по пакету на плагин. */
export const BASE_PLUGINS: readonly DomainPlugin[] = [
  { manifest: filesManifest, create: () => createFilesPlugin() },
  // Редактор кода — раньше предпросмотра markdown: тот одалживает его тело возможностью.
  { manifest: monacoManifest, create: () => createMonacoEditorPlugin() },
  { manifest: markdownManifest, create: () => createMarkdownPlugin() },
];

/**
 * Состав приложения с плагинами домена base.
 *
 * @param base на чём строить; по умолчанию — встроенный состав билдера.
 */
export function baseApplication(
  base: ApplicationComposition = fromProfile(builtinProfile('builder'))
): ApplicationComposition {
  return withDomainPlugins(base, BASE_PLUGINS);
}
