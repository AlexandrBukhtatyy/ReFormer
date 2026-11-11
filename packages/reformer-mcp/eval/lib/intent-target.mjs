/**
 * Intent эталона под таргет прогона.
 *
 * Таргет подставляется, а на `core` снимаются правила слоя рендера — видимость и правила узлов. На
 * core их исполнять некому: разметку рисует JSX, и `form_build` отвечает на них ошибкой
 * `not-on-target` (аудит 2026-11, B5). Агент переносит их в свою разметку; у стенда разметки нет —
 * он рисует схему рендерером (`drawCoreForm`), поэтому снимает их, как раньше их молча не печатала
 * сама сборка.
 */

/** Виды записей `behavior`, которые адресуют узел схемы, а не поле модели. */
export const NODE_RULE_KINDS = [
  'onComponentEvent',
  'renderEffect',
  'onInit',
  'onMount',
  'onUnmount',
];

/**
 * @param {Record<string, unknown>} intent
 * @param {string} target
 * @returns {Record<string, unknown>}
 */
export function intentForTarget(intent, target) {
  const next = { ...intent, target };
  if (target !== 'core') return next;
  delete next.visibility;
  delete next.nodes;
  if (Array.isArray(next.behavior)) {
    next.behavior = next.behavior.filter((record) => !NODE_RULE_KINDS.includes(record?.kind));
  }
  return next;
}
