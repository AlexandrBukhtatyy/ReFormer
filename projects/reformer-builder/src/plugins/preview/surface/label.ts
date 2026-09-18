/**
 * Как выбор поверхности превращается в слова.
 *
 * Имя поверхности переводит сама поверхность (`PreviewSurface.title`): вносят их плагины разных
 * стеков, и словарь каждого — его собственный. Причину отката переводит превью: её завёл этот
 * плагин. Живому виду ни тот, ни другой словарь не принадлежит, поэтому наружу уходят уже
 * переведённые строки, а не ключи.
 *
 * @module plugins/preview/surface/label
 */

import type { PreviewSurface } from '../contract';
import type { SurfaceFallback } from './selection';
import { refusalMessageKey } from '../schema/source-guard';

/** Перевод в пространстве имён превью. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Заголовок поверхности.
 *
 * Ключ разрешается словарём ПРЕВЬЮ, поэтому у чужой поверхности его нет — она покажет свой
 * идентификатор. Это названо в контракте: полноценное решение требует пары «ключ плюс плагин».
 */
export function surfaceTitle(surface: PreviewSurface): string {
  try {
    return surface.title?.() ?? surface.id;
  } catch (error) {
    // Имя переводит поверхность своим словарём, и её сбой не должен ронять того, кто её
    // показывает: без имени остаётся идентификатор, и это всё ещё ответ.
    console.error(`[preview] поверхность «${surface.id}»: title бросил`, error);
    return surface.id;
  }
}

/**
 * Почему показана не самая способная поверхность; `null` — показана она.
 *
 * Причина всегда одна по сорту — источник отказал в исполнении кода, — и её ключи заведены
 * в словаре ЗАПРЕТА, а не превью: там же, где записано само правило. Веток было две, пока
 * существовал переключатель: вторая объясняла, что запрошенной поверхности нет среди вкладов.
 * Просить конкретную поверхность больше некому, и вопрос отпал вместе с ней.
 */
export function fallbackMessage(fallback: SurfaceFallback | null, t: Translate): string | null {
  return fallback === null ? null : t(refusalMessageKey(fallback.reason));
}
