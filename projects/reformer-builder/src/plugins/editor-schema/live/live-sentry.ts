/**
 * Сторож класс-токенов живого вида: говорит, когда форма уже НА ЭКРАНЕ, а ни один её узел
 * не помечен.
 *
 * ## Почему не один кадр после монтирования
 *
 * Первая версия смотрела в DOM через кадр и ругалась на каждое открытие вида «Форма»
 * (ReFormer-twlf), хотя токены до DOM доезжали. Поверхность рисует форму не сразу: компилирующая
 * на первой сборке показывает «собирается», пока транспилируются сайдкары. Через кадр в DOM нет
 * формы — а значит, и токенов, и кит тут ни при чём.
 *
 * Поэтому сторож ждёт саму форму: наблюдает DOM поверхности и решает в первый момент, когда в нём
 * есть токен узла или поле. Поле узнаётся по `data-testid="input-…"` — его ставит рендерер
 * контролу каждого поля. Токен нашёлся — всё в порядке; поле есть, а токена нет — компоненты кита
 * не пробрасывают `className` на свой корень.
 *
 * Форма из одних контейнеров полей не имеет, и её сторож не проверяет: он отладочный, и молчание
 * в редком случае дешевле ложной тревоги в частом.
 *
 * @module plugins/editor-schema/live/live-sentry
 */

import type { Disposable, NodeId } from '@reformer/builder-plugin-api';
import { elementOf } from './live-hit';

/** Контрол поля — метка рендерера, по которой видно, что форма нарисована. */
const FIELD_SELECTOR = '[data-testid^="input-"]';

/**
 * Следит за DOM поверхности и зовёт `warn` не больше одного раза — если форма нарисована,
 * а ни один из `ids` не помечен. Решив (в любую сторону), перестаёт наблюдать.
 */
export function watchNodeTokens(
  surface: HTMLElement,
  ids: readonly NodeId[],
  warn: () => void
): Disposable {
  let done = false;
  let frame = 0;

  const stop = (): void => {
    done = true;
    observer.disconnect();
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
  };

  const check = (): void => {
    frame = 0;
    if (done) return;
    if (ids.some((id) => elementOf(surface, id) !== null)) {
      stop();
      return;
    }
    if (surface.querySelector(FIELD_SELECTOR) !== null) {
      stop();
      warn();
    }
  };

  // Проверка — после кадра, а не на каждую мутацию: отрисовка формы — сотни мутаций подряд.
  const observer = new MutationObserver(() => {
    if (frame === 0 && !done) frame = requestAnimationFrame(check);
  });
  observer.observe(surface, { childList: true, subtree: true });
  frame = requestAnimationFrame(check);

  return { dispose: stop };
}
