/**
 * CSS-правила подсветки узлов runtime-превью и владелец hover-стиля. Подсветка адресует узлы
 * класс-токенами ({@link annotateSchema}), а не атрибутами на DOM формы: React пересоздаёт узлы
 * при правках схемы и стёр бы навешанные атрибуты, а CSS-правило переживает любой ре-рендер.
 *
 * Рамка рисуется ПСЕВДОЭЛЕМЕНТОМ `::after`, а не `outline`. Причина — `outline` живёт в потоке
 * формы и подчиняется её каскаду: у кита с плотной вёрсткой и собственными позиционированными
 * обёртками (HexaUI — styled-components) обводка выделенного поля уходила под соседнее.
 * Псевдоэлемент с `z-index` участвует в stacking-контексте родителя и рисуется поверх соседей,
 * какие бы обёртки ни навешал кит.
 *
 * Плата — `position: relative` на подсвеченном узле, из-за чего он становится containing block для
 * абсолютно позиционированных потомков. Риск проверен на обоих китах: ни у одного узла нет
 * потомка, который якорился бы ВЫШЕ узла (иконки и чевроны полей позиционируются внутри своих
 * обёрток), и у всех `overflow: visible`, так что рамку не обрезает. Правило применяется только к
 * выделенному/наведённому узлу и только в режиме редактирования.
 *
 * Оверлеем (как индикатор дропа, см. `PreviewOverlay`) выделение не рисуем: подсветка постоянная,
 * и её пришлось бы синхронизировать с координатами узла при скролле, ресайзе, ре-рендере схемы и
 * асинхронной подгрузке. Псевдоэлемент приклеен к элементу и переживает всё это без кода.
 *
 * @module reformer-builder/canvas/preview-highlight-style
 */

import { useEffect, useRef, type RefObject } from 'react';
import { encodeNodeToken } from '../preview-runtime';
import type { JsonPath } from '../model';

/** Зазор между рамкой и габаритом узла: без него рамка липнет к рамке самого инпута. */
const INSET = '-4px';
const RADIUS = '6px';

/** Вид рамки: стиль границы и слой. Активный узел рисуется поверх группового, группа — поверх hover. */
interface Ring {
  border: string;
  z: number;
}

const ACTIVE: Ring = { border: '2px solid var(--rb-select)', z: 10 };
const GROUP: Ring = { border: '2px solid var(--rb-select-weak)', z: 9 };
const HOVER: Ring = { border: '1px dashed var(--rb-select-weak)', z: 8 };

/**
 * Правило подсветки одного узла в области `scope`: `position: relative` на самом узле и рамка на
 * `::after`. `pointer-events: none` обязателен — иначе рамка перехватит клик и сломает хит-тест.
 */
function rule(scope: string, path: JsonPath, ring: Ring): string {
  const token = encodeNodeToken(path);
  return (
    `${scope} .${token} { position: relative; }\n` +
    `${scope} .${token}::after { content: ''; position: absolute; inset: ${INSET}; ` +
    `border: ${ring.border}; border-radius: ${RADIUS}; pointer-events: none; z-index: ${ring.z}; }`
  );
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
