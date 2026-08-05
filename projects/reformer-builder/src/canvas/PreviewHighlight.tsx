/**
 * Подсветка выделения и hover в runtime-превью: два `<style>` с правилами по класс-токенам узлов.
 * Выделение — React-managed, hover — обновляется императивно через `hoverRef` ({@link useHoverStyle}),
 * чтобы движение мыши не ре-рендерило дерево формы.
 *
 * @module reformer-builder/canvas/PreviewHighlight
 */

import type { RefObject } from 'react';
import { selectionCss } from './preview-highlight-style';
import type { JsonPath } from '../model';

export function PreviewHighlight({
  scope,
  selectionPath,
  selectionPaths,
  hoverRef,
}: {
  /** Селектор хоста превью — ограничивает правила текущей вкладкой. */
  scope: string;
  selectionPath: JsonPath | null;
  selectionPaths: JsonPath[];
  /** Ref на `<style>` для hover-правила (владелец — {@link useHoverStyle}). */
  hoverRef: RefObject<HTMLStyleElement | null>;
}) {
  return (
    <>
      <style>{selectionCss(scope, selectionPath, selectionPaths)}</style>
      <style ref={hoverRef} />
    </>
  );
}
