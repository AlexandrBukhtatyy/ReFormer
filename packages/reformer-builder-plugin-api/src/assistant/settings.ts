/**
 * Секции настроек ассистента — то, что другие плагины показывают на экране настроек ассистента.
 *
 * Экран настроек ассистента — место, где человек настраивает всё, чем пользуется ассистент: модель
 * и её ключ, MCP-серверы и их секреты. Ассистент рисует свою секцию (провайдер модели) и под ней —
 * секции из этой точки. Плагин отдаёт компонент целиком и сам рисует в нём заголовок: словарь
 * плагина знает только он, а ассистент чужие ключи перевести не может.
 *
 * Секреты секция хранит сама — в `ctx.secrets` своего плагина, не в настройках проекта:
 * `settings.json` лежит в git.
 *
 * @module @reformer/builder-plugin-api/assistant/settings
 */

import type { ComponentType } from 'react';
import { defineExtensionPoint, type ExtensionPoint } from '../primitives/extension-point.js';

export interface AssistantSettingsSection {
  /** Имя секции — уникально среди секций, для ключа и тестов. */
  readonly id: string;
  /** Тело секции вместе с заголовком. Рисуется в области стилей плагина-вкладчика. */
  readonly Body: ComponentType<{ sectionId: string }>;
  /** Порядок под секцией провайдера: меньше — выше. По умолчанию 100. */
  readonly order?: number;
}

/**
 * Точка секций настроек ассистента. Ассистент читает её при открытии экрана настроек: секция
 * выключенного плагина исчезает.
 */
export const AssistantSettingsSectionPoint: ExtensionPoint<AssistantSettingsSection> =
  defineExtensionPoint<AssistantSettingsSection>('reformer.assistant.settings-section');
