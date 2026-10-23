import { describe, expect, it } from 'vitest';
import { applyOverrides, overrideDrift, targetsOfStack, type OverridableTarget } from './overrides';

const builtin: readonly OverridableTarget[] = [
  { id: 'gen.types', path: 'types/{dir}.ts' },
  { id: 'gen.registry', path: 'schema/registry.ts' },
  { id: 'gen.step', path: 'validation/{step}.ts', each: 'step' },
];

/** Стек узнаёт замену под прежний контракт: её цель — «gen.retired» или путь «flat/…». */
const stale = (target: OverridableTarget, replaced: OverridableTarget | undefined) =>
  target.overrides === 'gen.retired'
    ? 'цели больше нет'
    : replaced !== undefined && target.path.startsWith('flat/')
      ? 'прежняя раскладка'
      : null;

describe('applyOverrides', () => {
  it('цель, объявившая overrides, снимает названную', () => {
    const mine = { id: 'user.registry', path: 'schema/registry.ts', overrides: 'gen.registry' };
    expect(applyOverrides([...builtin, mine]).map((t) => t.id)).toEqual([
      'gen.types',
      'gen.step',
      'user.registry',
    ]);
  });

  it('замена несуществующей цели никого не трогает', () => {
    const mine = { id: 'user.x', path: 'x.ts', overrides: 'gen.nope' };
    expect(applyOverrides([...builtin, mine])).toHaveLength(builtin.length + 1);
  });

  it('без замен список возвращается той же ссылкой', () => {
    expect(applyOverrides(builtin)).toBe(builtin);
  });

  it('устаревшая замена не побеждает и не печатается', () => {
    const flat = { id: 'user.registry', path: 'flat/registry.ts', overrides: 'gen.registry' };
    const retired = { id: 'user.wizard', path: 'wizard.tsx', overrides: 'gen.retired' };
    expect(applyOverrides([...builtin, flat, retired], stale)).toEqual(builtin);
  });
});

describe('overrideDrift', () => {
  it('замена по тому же пути — молчит', () => {
    const mine = { id: 'user.registry', path: 'schema/registry.ts', overrides: 'gen.registry' };
    expect(overrideDrift([...builtin, mine], stale)).toEqual([]);
  });

  it('иной путь — предупреждение, что модуль импортирует другое', () => {
    const mine = { id: 'user.registry', path: 'registry.ts', overrides: 'gen.registry' };
    const [drift] = overrideDrift([...builtin, mine]);
    expect(drift).toMatchObject({
      targetId: 'user.registry',
      path: 'registry.ts',
      reason: 'override-path-drift',
    });
    expect(drift.message).toContain('«schema/registry.ts»');
  });

  it('замена по шагам без «each» — тоже сдвиг', () => {
    const mine = { id: 'user.step', path: 'validation/{step}.ts', overrides: 'gen.step' };
    expect(overrideDrift([...builtin, mine])[0].message).toContain('"each": "step"');
  });

  it('причина устаревания — текстом стека, и заменённую цель не ищут', () => {
    const flat = { id: 'user.registry', path: 'flat/registry.ts', overrides: 'gen.registry' };
    const retired = { id: 'user.wizard', path: 'wizard.tsx', overrides: 'gen.retired' };
    expect(overrideDrift([...builtin, flat, retired], stale).map((d) => d.message)).toEqual([
      'прежняя раскладка',
      'цели больше нет',
    ]);
  });
});

describe('targetsOfStack', () => {
  const targets = [
    { id: 'a.types', path: 'types.ts', stack: 'a' },
    { id: 'b.form', path: 'Form.tsx', stack: 'b' },
    { id: 'any.readme', path: 'README.md' },
    { id: 'user.types', path: 'types.ts', overrides: 'a.types' },
    { id: 'user.free', path: 'free.ts' },
  ];

  it('свои, общие и замены своих — замена наследует стек заменённой', () => {
    expect(targetsOfStack(targets, 'a').map((t) => t.id)).toEqual([
      'a.types',
      'any.readme',
      'user.types',
      'user.free',
    ]);
    expect(targetsOfStack(targets, 'b').map((t) => t.id)).toEqual([
      'b.form',
      'any.readme',
      'user.free',
    ]);
  });

  it('свой стек замены сильнее унаследованного', () => {
    const mine = { id: 'user.b', path: 'types.ts', overrides: 'a.types', stack: 'b' };
    expect(targetsOfStack([...targets, mine], 'a').map((t) => t.id)).not.toContain('user.b');
  });
});
