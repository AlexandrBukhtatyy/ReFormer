/**
 * Правила подсветки живой формы.
 *
 * @module plugins/editor-schema/live/live-style.test
 */

import { describe, expect, it } from 'vitest';
import { EMPTY_CLASS } from '@/lib/form-model/node-token';
import { hoverCss, liveCss } from './live-style';

const SCOPE = 'rb1';
const A = 'a1b2c3d4';
const B = 'b2c3d4e5';

function css(overrides: Partial<Parameters<typeof liveCss>[0]> = {}): string {
  return liveCss({ scope: SCOPE, selection: [], hover: null, dragging: false, ...overrides });
}

describe('liveCss', () => {
  it('пустые контейнеры получают габарит всегда, а не только при перетаскивании', () => {
    // Контейнер без детей схлопывается в ноль: в покое его не видно и не выделить.
    expect(css()).toContain(`.${EMPTY_CLASS}`);
    expect(css()).toContain('min-height');
  });

  it('перетаскивание меняет только правило пустых контейнеров', () => {
    const idle = css();
    const dragging = css({ dragging: true });
    expect(dragging).not.toBe(idle);
    expect(dragging.split('\n')).toHaveLength(idle.split('\n').length);
  });

  it('каждое правило ограничено областью: подсветок на экране может быть две', () => {
    const rules = css({ selection: [A, B] }).split('\n');
    expect(rules.length).toBeGreaterThan(1);
    for (const rule of rules) expect(rule).toContain(`[data-rb-live="${SCOPE}"]`);
  });

  it('активен последний выбранный — тот же, которым командуют клавиши', () => {
    const rules = css({ selection: [A, B] });
    const activeAt = rules.indexOf(B);
    const selectedAt = rules.indexOf(A);
    expect(activeAt).toBeGreaterThan(selectedAt);
    // Активный контур толще: набор виден, но глаз ведёт один узел.
    expect(rules).toContain('outline: 2px solid');
    expect(rules).toContain('outline: 1px solid');
  });

  it('единственный выбранный — сразу активный, без бледной копии', () => {
    const rules = css({ selection: [A] });
    expect(rules).toContain('outline: 2px solid');
    expect(rules).not.toContain('outline: 1px solid');
  });

  it('адрес не той формы в таблицу стилей не попадает', () => {
    const rules = css({ selection: ['"] { display: none } .x', A] });
    expect(rules).not.toContain('display: none');
    expect(rules).toContain(A);
  });

  it('без выделения остаётся только правило пустых контейнеров', () => {
    expect(css().split('\n')).toHaveLength(1);
  });
});

describe('hoverCss', () => {
  it('наводить не на что — правил нет', () => {
    expect(hoverCss(SCOPE, null)).toBe('');
  });

  it('наведение рисуется пунктиром и тоже ограничено областью', () => {
    const rule = hoverCss(SCOPE, A);
    expect(rule).toContain('dashed');
    expect(rule).toContain(`[data-rb-live="${SCOPE}"]`);
    expect(rule).toContain(A);
  });

  it('мусорный адрес не даёт правила вовсе', () => {
    expect(hoverCss(SCOPE, 'не адрес')).toBe('');
  });
});

describe('liveCss: контуры находок', () => {
  it('узел с находкой обводится по строгости теми же токенами, что пометки в дереве', () => {
    const rules = css({
      problems: new Map([
        [A, 'error'],
        [B, 'warning'],
      ]),
    });
    expect(rules).toContain(`.${'rbnode-'}${A}`);
    expect(rules).toMatch(new RegExp(`${A}[^\\n]*solid[^\\n]*--color-destructive`));
    expect(rules).toMatch(new RegExp(`${B}[^\\n]*dashed`));
  });

  it('выделение сильнее находки: правило выбора идёт позже и побеждает', () => {
    const rules = css({ selection: [A], problems: new Map([[A, 'error']]) }).split('\n');
    const problem = rules.findIndex((rule) => rule.includes('--color-destructive'));
    const active = rules.findIndex((rule) => rule.includes('--color-ring'));
    expect(problem).toBeGreaterThan(-1);
    expect(active).toBeGreaterThan(problem);
  });

  it('находки ограничены областью, а мусорный адрес не даёт правила', () => {
    const rules = css({
      problems: new Map([
        [A, 'info'],
        ['не адрес', 'error'],
      ]),
    }).split('\n');
    expect(rules).toHaveLength(2);
    expect(rules[1]).toContain(`[data-rb-live="${SCOPE}"]`);
  });

  it('без находок таблица та же, что и раньше', () => {
    expect(css({ problems: new Map() })).toBe(css());
  });
});
