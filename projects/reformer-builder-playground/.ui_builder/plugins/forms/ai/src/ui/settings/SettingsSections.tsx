/**
 * Секции настроек ассистента от других плагинов — под настройками провайдера модели.
 *
 * Экран настроек ассистента — одно место для всего, чем ассистент пользуется: модель и её ключ,
 * MCP-серверы и их секреты. Секция рисуется в области стилей своего плагина и сама несёт заголовок:
 * чужой словарь ассистент перевести не может. Список живой — секция выключенного плагина исчезает.
 *
 * @module plugins/forms/ai/ui/settings/SettingsSections
 */

import { createElement, useCallback, useRef, useSyncExternalStore, type ReactElement } from 'react';
import {
  AssistantSettingsSectionPoint,
  pluginScopeAttributes,
  type PluginContext,
} from '@reformer/builder-plugin-api';

/** Что секциям нужно от реестра вкладов. */
export type SectionsSource = Pick<PluginContext['extensions'], 'get' | 'observe'>;

/** Вклад секции, как его отдаёт реестр: со своим плагином и порядком. */
type SectionContribution = ReturnType<typeof getSections>[number];

function getSections(source: SectionsSource) {
  return source.get(AssistantSettingsSectionPoint);
}

const DEFAULT_ORDER = 100;

function ordered(sections: readonly SectionContribution[]): readonly SectionContribution[] {
  return [...sections].sort(
    (a, b) =>
      (a.value.order ?? DEFAULT_ORDER) - (b.value.order ?? DEFAULT_ORDER) || a.order - b.order
  );
}

/** Тот же состав: те же вклады с теми же значениями — снимок не меняется, перерисовки нет. */
function sameSections(
  a: readonly SectionContribution[],
  b: readonly SectionContribution[]
): boolean {
  return (
    a.length === b.length &&
    a.every((item, i) => item.id === b[i]!.id && item.value === b[i]!.value)
  );
}

/** Живой список секций: подписка на точку, снимок кэшируется по составу. */
function useSections(source: SectionsSource): readonly SectionContribution[] {
  const cache = useRef<{
    raw: readonly SectionContribution[];
    sorted: readonly SectionContribution[];
  } | null>(null);
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = source.observe(AssistantSettingsSectionPoint, onChange);
      return () => subscription.dispose();
    },
    [source]
  );
  const snapshot = useCallback(() => {
    const raw = getSections(source);
    if (cache.current && sameSections(cache.current.raw, raw)) return cache.current.sorted;
    const sorted = ordered(raw);
    cache.current = { raw, sorted };
    return sorted;
  }, [source]);
  return useSyncExternalStore(subscribe, snapshot);
}

export function SettingsSections({ source }: { source: SectionsSource }): ReactElement | null {
  const sections = useSections(source);
  if (sections.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 border-t px-3 pt-4 pb-3">
      {sections.map((section) => (
        <div
          key={section.id}
          data-testid={`ai-settings-section-${section.value.id}`}
          {...pluginScopeAttributes(section.pluginId)}
        >
          {createElement(section.value.Body, { sectionId: section.value.id })}
        </div>
      ))}
    </div>
  );
}
