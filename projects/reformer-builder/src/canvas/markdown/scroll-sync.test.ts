import { describe, expect, it } from 'vitest';
import { lineToOffset, offsetToLine, type SourceAnchor } from './scroll-sync';

// Три блока: строка 1 в самом верху, строка 10 на 100px, строка 20 на 400px.
const anchors: SourceAnchor[] = [
  { line: 1, top: 0 },
  { line: 10, top: 100 },
  { line: 20, top: 400 },
];

describe('lineToOffset', () => {
  it('попадание в якорь', () => {
    expect(lineToOffset(anchors, 1)).toBe(0);
    expect(lineToOffset(anchors, 10)).toBe(100);
    expect(lineToOffset(anchors, 20)).toBe(400);
  });

  it('интерполяция между якорями', () => {
    expect(lineToOffset(anchors, 5)).toBeCloseTo(400 / 9); // 4/9 пути от 0 к 100
    expect(lineToOffset(anchors, 15)).toBe(250);
  });

  it('после последнего якоря — его позиция (хвост документа не экстраполируем)', () => {
    expect(lineToOffset(anchors, 40)).toBe(400);
  });

  it('до первого якоря — интерполяция от начала документа', () => {
    const shifted: SourceAnchor[] = [
      { line: 5, top: 80 },
      { line: 9, top: 160 },
    ];
    expect(lineToOffset(shifted, 3)).toBe(40); // (3-1)/(5-1) * 80
    expect(lineToOffset(shifted, 1)).toBe(0);
  });

  it('вырожденные случаи', () => {
    expect(lineToOffset([], 7)).toBe(0);
    expect(lineToOffset([{ line: 3, top: 60 }], 99)).toBe(60);
    // Совпавшие строки не должны давать деления на ноль.
    expect(lineToOffset([{ line: 1, top: 0 }], 1)).toBe(0);
  });
});

describe('offsetToLine', () => {
  it('обратна lineToOffset в узлах и между ними', () => {
    expect(offsetToLine(anchors, 0)).toBe(1);
    expect(offsetToLine(anchors, 100)).toBe(10);
    expect(offsetToLine(anchors, 250)).toBe(15);
    expect(offsetToLine(anchors, 400)).toBe(20);
  });

  it('за последним якорем — его строка', () => {
    expect(offsetToLine(anchors, 5000)).toBe(20);
  });

  it('выше первого якоря — интерполяция к первой строке', () => {
    const shifted: SourceAnchor[] = [
      { line: 5, top: 80 },
      { line: 9, top: 160 },
    ];
    expect(offsetToLine(shifted, 40)).toBe(3);
    expect(offsetToLine(shifted, 0)).toBe(1);
  });

  it('пустые якоря → первая строка', () => {
    expect(offsetToLine([], 300)).toBe(1);
  });
});
