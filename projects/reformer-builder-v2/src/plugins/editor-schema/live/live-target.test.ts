/**
 * Куда встанет бросок в живой форме.
 *
 * Проверяется без DOM: прямоугольники подставляются параметром, поэтому и `grid`, где
 * объявленная ось врёт, здесь выражается числами.
 *
 * @module plugins/editor-schema/live/live-target.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { ensureNodeIds, newNodeId } from '@/lib/form-model/node-id';
import type { NodeId } from '@/sdk';
import type { DragPayload } from '../editing/drag';
import { siblingsOf, targetAt } from './live-target';
import { indexNodes } from '../model/node-index';
import { buildSchematic } from '../schematic/schematic-tree';
import type { Rect } from '../schematic/schematic-zone';

const NEW_NODE: JsonNode = { value: '$model(новое)', component: '$component(Input)' };
const NEW: DragPayload = { kind: 'new', node: NEW_NODE };

const FIELD_0 = ['root', 'componentProps', 'steps', 0, 'children', 0] as const;
const FIELD_1 = ['root', 'componentProps', 'steps', 0, 'children', 1] as const;

function fixture() {
  const model: JsonFormSchema = ensureNodeIds(sampleSchema(), newNodeId);
  const tree = buildSchematic(model);
  const index = indexNodes(model);
  const idAt = (path: readonly (string | number)[]): NodeId => {
    const id = index.idAt(path);
    if (id === undefined) throw new Error(`нет узла по пути ${path.join('/')}`);
    return id;
  };
  return { model, tree, idAt };
}

/** Прямоугольник поля: по умолчанию поля стоят столбцом, как их и объявили. */
const column = (index: number): Rect => ({ left: 0, top: index * 60, width: 300, height: 40 });
/** Те же поля, но браузер разложил их в ряд — например, из-за `grid-cols-2`. */
const row = (index: number): Rect => ({ left: index * 320, top: 0, width: 300, height: 40 });

describe('targetAt', () => {
  it('объявленная ось работает, когда измерять нечего', () => {
    const { model, tree, idAt } = fixture();
    const target = idAt(FIELD_0);
    const rect = column(0);
    // Соседей не измерить — их прямоугольников нет; остаётся объявленная ось (столбец).
    const result = targetAt(
      { model, tree, rectOf: () => null },
      { id: target, rect },
      midLeft(rect),
      NEW
    );
    // Левый край в столбце — поперечный: он рождает обёртку-ряд.
    expect(result?.spot.zone).toBe('beside-before');
    expect(result?.horizontalParent).toBe(false);
  });

  it('измеренная ось побеждает объявленную', () => {
    const { model, tree, idAt } = fixture();
    const first = idAt(FIELD_0);
    const second = idAt(FIELD_1);
    const rects = new Map<NodeId, Rect>([
      [first, row(0)],
      [second, row(1)],
    ]);
    const rect = row(0);

    const result = targetAt(
      { model, tree, rectOf: (id) => rects.get(id) ?? null },
      { id: first, rect },
      midLeft(rect),
      NEW
    );

    // Ось измерена как ряд, поэтому левый край стал ГЛАВНЫМ: это «перед соседом»,
    // а не обёртка. Объявленная ось дала бы здесь `beside-before` — см. тест выше.
    expect(result?.spot.zone).toBe('before');
    expect(result?.horizontalParent).toBe(true);
  });

  it('середина контейнера означает «внутрь»', () => {
    const { model, tree, idAt } = fixture();
    const step = idAt(['root', 'componentProps', 'steps', 0]);
    const rect: Rect = { left: 0, top: 0, width: 400, height: 300 };
    const result = targetAt(
      { model, tree, rectOf: () => null },
      { id: step, rect },
      { x: 200, y: 150 },
      NEW
    );
    expect(result?.spot.zone).toBe('into');
  });

  it('узел не из этой модели целью не становится', () => {
    const { model, tree } = fixture();
    const rect = column(0);
    expect(
      targetAt({ model, tree, rectOf: () => null }, { id: 'zzzzzzzz', rect }, midLeft(rect), NEW)
    ).toBeNull();
  });

  it('отказ планировщика виден как отсутствие цели — до отпускания кнопки', () => {
    const { model, tree, idAt } = fixture();
    const field = idAt(FIELD_0);
    const rect = column(0);
    // Узел нельзя бросить внутрь самого себя, и это должно быть видно ДО броска.
    const self: DragPayload = { kind: 'node', id: field };
    const result = targetAt(
      { model, tree, rectOf: () => null },
      { id: field, rect },
      { x: 150, y: 20 },
      self
    );
    expect(result).toBeNull();
  });

  it('прямоугольник цели возвращается как есть: по нему рисуется указатель', () => {
    const { model, tree, idAt } = fixture();
    const rect = column(1);
    const result = targetAt(
      { model, tree, rectOf: () => null },
      { id: idAt(FIELD_1), rect },
      midLeft(rect),
      NEW
    );
    expect(result?.rect).toBe(rect);
  });
});

describe('siblingsOf', () => {
  it('соседи по слоту включают сам узел: ось считается по ряду целиком', () => {
    const { tree, idAt } = fixture();
    const first = idAt(FIELD_0);
    const siblings = siblingsOf(tree, first);
    expect(siblings).toContain(first);
    expect(siblings).toContain(idAt(FIELD_1));
  });

  it('у корня соседей нет', () => {
    const { tree, idAt } = fixture();
    expect(siblingsOf(tree, idAt(['root']))).toEqual([]);
  });

  it('незнакомый адрес соседей не даёт', () => {
    const { tree } = fixture();
    expect(siblingsOf(tree, 'zzzzzzzz')).toEqual([]);
  });
});

/** Точка у левого края, по вертикали посередине. */
function midLeft(rect: Rect): { x: number; y: number } {
  return { x: rect.left + rect.width * 0.05, y: rect.top + rect.height / 2 };
}
