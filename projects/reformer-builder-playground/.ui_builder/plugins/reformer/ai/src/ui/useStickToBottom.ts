/**
 * Лента держится у нижнего края, пока человек сам там, и не трогает прокрутку, когда он ушёл
 * читать выше.
 *
 * Прежде лента прокручивалась к концу на каждое изменение — то есть на каждый кусок ответа
 * модели: развернуть рассуждение и прочитать его во время хода было нельзя, лента уезжала из-под
 * глаз. Новый запрос человека возвращает к концу всегда: он смотрит на то, что спросил.
 *
 * Поведение, а не оформление: вьюпорт находится по разметке кита (`data-slot`), прокрутку
 * по-прежнему рисует `ScrollArea`.
 *
 * @module plugins/reformer/ai/ui/useStickToBottom
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/** Насколько можно не доехать до низа и всё ещё считаться внизу, пиксели. */
const BOTTOM_SLACK = 24;

const viewportOf = (root: HTMLElement | null): HTMLElement | null =>
  root?.querySelector<HTMLElement>(':scope > [data-slot="scroll-area-viewport"]') ?? null;

/**
 * @param root - Корень `ScrollArea` ленты.
 * @param mounted - Лента на экране: до первой реплики на её месте подсказка, и вьюпорта нет.
 * @param content - Меняется вместе с содержимым ленты: по нему лента догоняет низ.
 * @param pin - Меняется, когда человек отправил реплику: по нему лента едет к низу всегда.
 */
export function useStickToBottom(
  root: RefObject<HTMLElement | null>,
  mounted: boolean,
  content: unknown,
  pin: unknown
): void {
  const atBottom = useRef(true);

  useEffect(() => {
    if (!mounted) return;
    const viewport = viewportOf(root.current);
    if (viewport === null) return;
    const onScroll = (): void => {
      atBottom.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= BOTTOM_SLACK;
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', onScroll);
    };
  }, [root, mounted]);

  // Два эффекта, и порядок важен: сначала новая реплика человека возвращает «внизу», затем
  // содержимое догоняет низ — в одном и том же кадре.
  useLayoutEffect(() => {
    atBottom.current = true;
  }, [pin]);

  useLayoutEffect(() => {
    const viewport = viewportOf(root.current);
    if (viewport !== null && atBottom.current) viewport.scrollTop = viewport.scrollHeight;
  }, [root, content, pin]);
}
