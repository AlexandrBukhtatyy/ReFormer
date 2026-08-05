/**
 * CSS-правила подсветки узлов runtime-превью и владелец hover-стиля. Подсветка адресует узлы
 * класс-токенами ({@link annotateSchema}), а не атрибутами на DOM формы: React пересоздаёт узлы
 * при правках схемы и стёр бы навешанные атрибуты, а CSS-правило переживает любой ре-рендер.
 *
 * `outline` (а не `border`) — чтобы не влиять на раскладку формы и не требовать `position: relative`
 * на её элементах.
 *
 * @module reformer-builder/canvas/preview-highlight-style
 */

import { useEffect, useRef, type RefObject } from 'react';
import { encodeNodeToken } from '../preview-runtime';
import type { JsonPath } from '../model';

const ACTIVE = 'outline: 2px solid var(--rb-select); outline-offset: 1px; border-radius: 3px;';
const GROUP = 'outline: 2px solid var(--rb-select-weak); outline-offset: 1px; border-radius: 3px;';
const HOVER = 'outline: 1px dashed var(--rb-select-weak); outline-offset: 1px; border-radius: 3px;';

/** Правило подсветки одного узла в области `scope`. */
function rule(scope: string, path: JsonPath, decl: string): string {
  return `${scope} .${encodeNodeToken(path)} { ${decl} }`;
}

/** CSS выделения: группа — бледной рамкой, активный узел — плотной. */
export function selectionCss(
  scope: string,
  selectionPath: JsonPath | null,
  selectionPaths: JsonPath[]
): string {
  return [
    ...selectionPaths.map((p) => rule(scope, p, GROUP)),
    ...(selectionPath ? [rule(scope, selectionPath, ACTIVE)] : []),
  ].join('\n');
}

/**
 * Владелец hover-стиля: ref на `<style>` и сеттер пути. Обновляет `textContent` напрямую —
 * движение мыши не должно ре-рендерить дерево формы.
 */
export function useHoverStyle(scope: string): {
  hoverRef: RefObject<HTMLStyleElement | null>;
  setHoverPath: (path: JsonPath | null) => void;
} {
  const hoverRef = useRef<HTMLStyleElement | null>(null);
  const lastRef = useRef<string>('');

  const setHoverPath = (path: JsonPath | null) => {
    const css = path ? rule(scope, path, HOVER) : '';
    if (css === lastRef.current) return;
    lastRef.current = css;
    if (hoverRef.current) hoverRef.current.textContent = css;
  };

  // Размонтирование/смена вкладки — сбросить, чтобы «залипший» hover не пережил переключение.
  useEffect(
    () => () => {
      lastRef.current = '';
      if (hoverRef.current) hoverRef.current.textContent = '';
    },
    []
  );

  return { hoverRef, setHoverPath };
}
