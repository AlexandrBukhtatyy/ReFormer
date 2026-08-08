/**
 * Состояние исполнения схем формы — общее для превью и нижней панели.
 *
 * Живёт ВНЕ `live/` намеренно: панель «Форма» должна читать статус и ошибки, не притягивая в свой
 * чанк компилятор. Типы отсюда импортируются `type`-only, поэтому рантайм-зависимости на `live/`
 * этот модуль не создаёт.
 *
 * Приём тот же, что у {@link module:reformer-builder/preview-runtime/active-preview}: модуль-состояние
 * с подпиской, читается через `useSyncExternalStore`. Владелец записи — хук превью
 * (`canvas/useLiveForm`), остальные только читают.
 *
 * @module reformer-builder/preview-runtime/live-state
 */

import type { AppliedArtifact, LiveBundle, LiveError } from './live';

/**
 * Стадия исполнения схем:
 * - `off` — тумблер выключен, превью рисует layout-only путь;
 * - `unavailable` — включать нечего: вкладка не связана с файлом проекта;
 * - `loading` — идёт компиляция каталога;
 * - `ready` — бандл собран (возможно, с частичными ошибками в `errors`);
 * - `error` — собрать не удалось совсем, превью откатилось на layout-only.
 */
export type LiveStatus = 'off' | 'unavailable' | 'loading' | 'ready' | 'error';

/** Снимок состояния исполнения схем. */
export interface LiveState {
  status: LiveStatus;
  bundle: LiveBundle | null;
  /** Ошибки компиляции/исполнения по файлам — панель «Сборка». */
  errors: LiveError[];
  /** Какие артефакты подключились (`model`, `validation`, …). */
  applied: AppliedArtifact[];
  /** Файлы каталога, которые попали в сборку. */
  files: string[];
  /** Из них — взятые из несохранённых вкладок Monaco. */
  fromEditor: string[];
}

const EMPTY: LiveState = {
  status: 'off',
  bundle: null,
  errors: [],
  applied: [],
  files: [],
  fromEditor: [],
};

let state: LiveState = EMPTY;
const listeners = new Set<() => void>();

/** Опубликовать состояние. Вызывает владелец — хук превью. */
export function setLiveState(next: LiveState): void {
  if (state === next) return;
  state = next;
  for (const notify of listeners) notify();
}

/** Сбросить к «выключено» (размонтирование превью, смена вкладки). */
export function resetLiveState(): void {
  setLiveState(EMPTY);
}

/** Снимок состояния (стабильная ссылка между изменениями — требование useSyncExternalStore). */
export function getLiveState(): LiveState {
  return state;
}

/** Подписка на смену состояния. */
export function subscribeLiveState(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
