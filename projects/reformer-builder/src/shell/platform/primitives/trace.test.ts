import { afterEach, describe, expect, it } from 'vitest';
import { startupSummary, traced, traceSinceStart, traceSpan, TRACE_PREFIX } from './trace';

/** Меры этого файла — под своим именем: буфер `performance` общий на прогон. */
const own = (name: string): string => `trace-test.${name}`;

afterEach(() => {
  for (const entry of performance.getEntriesByType('measure')) {
    if (entry.name.startsWith(`${TRACE_PREFIX}trace-test.`)) performance.clearMeasures(entry.name);
  }
});

const named = (name: string) => startupSummary().phases.filter((phase) => phase.name === own(name));

describe('меры запуска', () => {
  it('мера открывается и закрывается один раз: повторное закрытие ничего не добавляет', () => {
    const end = traceSpan(own('span'));
    expect(named('span')).toHaveLength(0);

    end();
    end();

    expect(named('span')).toHaveLength(1);
    expect(named('span')[0].duration).toBeGreaterThanOrEqual(0);
  });

  it('мера вокруг синхронного вызова отдаёт его результат', () => {
    expect(traced(own('sync'), () => 42)).toBe(42);
    expect(named('sync')).toHaveLength(1);
  });

  it('мера вокруг обещания закрывается, когда оно выполнилось, а не когда вернулось', async () => {
    let release = (): void => {};
    const pending = traced(
      own('async'),
      () => new Promise<string>((resolve) => (release = () => resolve('готово')))
    );
    expect(named('async')).toHaveLength(0);

    release();

    expect(await pending).toBe('готово');
    expect(named('async')).toHaveLength(1);
  });

  it('отказ не теряет меру: упавший шаг стоил своё время', async () => {
    expect(() =>
      traced(own('throws'), () => {
        throw new Error('сломано');
      })
    ).toThrow('сломано');
    await expect(traced(own('rejects'), () => Promise.reject(new Error('отказ')))).rejects.toThrow(
      'отказ'
    );

    expect(named('throws')).toHaveLength(1);
    expect(named('rejects')).toHaveLength(1);
  });

  it('сводка складывает меры по фазе — части имени до двоеточия', () => {
    traceSpan(own('read:acme.one'))();
    traceSpan(own('read:acme.two'))();
    traceSinceStart(own('first-frame'));

    const totals = startupSummary().totals;

    expect(totals.find((total) => total.phase === own('read'))?.count).toBe(2);
    expect(totals.find((total) => total.phase === own('first-frame'))?.count).toBe(1);
    // Мера «от начала» начинается в нуле: это отметка события, а не длительность шага.
    expect(named('first-frame')[0].start).toBe(0);
  });

  it('отметка «не позже» отсекает то, что началось после неё', async () => {
    traceSpan(own('early'))();
    const cut = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 5));
    traceSpan(own('late'))();

    const names = startupSummary({ until: cut }).phases.map((phase) => phase.name);

    expect(names).toContain(own('early'));
    expect(names).not.toContain(own('late'));
  });
});
