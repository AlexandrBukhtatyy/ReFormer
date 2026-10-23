import { describe, expect, it } from 'vitest';
import { joinWithinBudget } from './budget';
import { similarNames } from './suggest';
import { measureToolSurface } from './tool-surface';

describe('similarNames — похожие имена для подсказки модели', () => {
  it('подстрока идёт раньше опечатки', () => {
    expect(similarNames('TextInput', ['Input', 'Textarea', 'Select'])).toEqual(['Input']);
    expect(similarNames('Selct', ['Input', 'Select'])).toEqual(['Select']);
  });

  it('пустой запрос — пустой ответ', () => {
    expect(similarNames('', ['Input'])).toEqual([]);
  });
});

describe('joinWithinBudget — ответ по целым строкам', () => {
  const notice = (shown: number, total: number) => `… ${total - shown} more`;

  it('всё влезло — без уведомления', () => {
    expect(joinWithinBudget(['head'], ['a', 'b'], 100, notice)).toBe('head\na\nb');
  });

  it('не влезло — целые строки и явное уведомление о неполноте', () => {
    const text = joinWithinBudget(['head'], ['aaaa', 'bbbb', 'cccc'], 20, notice);
    expect(text).toBe('head\naaaa\n… 2 more');
    expect(text.length).toBeLessThanOrEqual(20);
  });
});

describe('measureToolSurface — то, за что платится каждый шаг', () => {
  it('считает имя, описание и схему, а прочие поля инструмента — нет', () => {
    const bare = { name: 'x', description: 'd', inputSchema: { type: 'object' } };
    const withRun = { ...bare, readOnly: true, run: () => 'ok' };
    expect(measureToolSurface([withRun])).toBe(measureToolSurface([bare]));
    expect(measureToolSurface([bare])).toBe(JSON.stringify([bare]).length);
  });
});
