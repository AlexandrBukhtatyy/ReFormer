/**
 * Реестр фокуса текстовых редакторов — реализация объявленной возможности.
 *
 * Объявление и довод, зачем реестр живёт в платформе, — в пакете `@reformer/builder-plugin-api`.
 *
 * @module shell/platform/workspace/model/text-editor-focus
 */

import type { ResourceId, TextEditorFocusRegistry } from '@reformer/builder-plugin-api/internal';

/**
 * Создаёт реестр фокуса.
 *
 * Один на приложение: его создаёт композиция, регистрирует службой и им же отвечает рабочей
 * области. Два реестра означали бы два разных ответа на один вопрос — и ровно ту потерю
 * набранного, ради которой реестр переехал в платформу.
 */
export function createTextEditorFocusRegistry(): TextEditorFocusRegistry {
  const focused = new Set<ResourceId>();
  return {
    isFocused: (id) => focused.has(id),
    setFocused(id, value) {
      if (value) focused.add(id);
      else focused.delete(id);
    },
    hasFocus: () => focused.size > 0,
  };
}
