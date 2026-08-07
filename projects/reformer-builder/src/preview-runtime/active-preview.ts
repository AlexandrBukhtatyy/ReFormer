/**
 * Ссылка на модель ЖИВОГО превью — чтобы нижняя панель могла показывать текущие значения формы.
 *
 * Почему не проп и не контекст: превью (`canvas/RuntimePreview`) и панель (`canvas/BottomPanel`) —
 * соседи в дереве, общего владельца у них нет, а прокидывать модель через `CanvasArea` означало бы
 * ре-рендерить панель на каждую пересборку превью. Здесь — тот же приём, что у `kits/active`:
 * модуль-состояние с подпиской, читается через `useSyncExternalStore`.
 *
 * ВАЖНО: связь односторонняя, панель только ЧИТАЕТ. Обратная запись (ввод в поле → `tab.mock`)
 * недопустима: `buildPreview` мемоизирован по `[annotated, mock]`, смена identity мока пересоздала
 * бы форму и фокус слетал бы на каждом нажатии клавиши (см. комментарий в `RuntimePreview`).
 *
 * @module reformer-builder/preview-runtime/active-preview
 */

/** Модель активного превью (`FormModel` из `@reformer/core`) либо `null`, если превью не смонтировано. */
let activeModel: unknown = null;

const listeners = new Set<() => void>();

/** Опубликовать модель текущего превью. Вызывает `RuntimePreview` при пересборке бандла. */
export function setActivePreviewModel(model: unknown): void {
  if (activeModel === model) return;
  activeModel = model;
  for (const notify of listeners) notify();
}

/** Модель активного превью (снимок ссылки, не значений). */
export function getActivePreviewModel(): unknown {
  return activeModel;
}

/** Подписка на СМЕНУ модели (не на изменение значений — за ними следит `effect`). */
export function subscribeActivePreviewModel(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
