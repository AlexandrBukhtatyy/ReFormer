import { describe, expect, it } from 'vitest';
import { builtinKit, foreignKit } from './__fixtures__/kit';
import { resolveComponent } from './components';

describe('резолв компонента', () => {
  it('символ берётся из каталога кита, а не из имени записи', () => {
    // `Input` в `@reformer/ui-kit` экспортируется как `InputField` — это и должно попасть
    // в сгенерированный импорт.
    expect(resolveComponent('Input', builtinKit()).symbol).toBe('InputField');
  });

  it('ЧУЖОЙ кит даёт ЧУЖИЕ символы: захардкоженного ui-kit больше нет', () => {
    const resolution = resolveComponent('Input', foreignKit());
    expect(resolution.symbol).toBe('HexInput');
    expect(resolution.placeholder).toBe(false);
  });

  it('оверлей помечается заглушкой с причиной из дескриптора', () => {
    const resolution = resolveComponent('Dialog', builtinKit());
    expect(resolution.placeholder).toBe(true);
    expect(resolution.reason).toContain('оверлей');
  });

  it('subpath-only компонент помечается диагностической причиной кита', () => {
    const resolution = resolveComponent('Command', builtinKit());
    expect(resolution.placeholder).toBe(true);
    expect(resolution.reason).toContain('subpath-only');
  });

  it('визард уходит в шим, а не в импорт из кита', () => {
    expect(resolveComponent('Wizard', builtinKit())).toMatchObject({
      shim: true,
      placeholder: false,
      symbol: null,
    });
  });

  it('имя вне каталога называет кит, а не «ui-kit»', () => {
    const resolution = resolveComponent('НетТакого', foreignKit());
    expect(resolution.placeholder).toBe(true);
    expect(resolution.reason).toContain('HexaUI');
  });
});
