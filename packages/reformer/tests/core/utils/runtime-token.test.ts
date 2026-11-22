/**
 * Штамп копии рантайма ядра (`CORE_RUNTIME_TOKEN`).
 *
 * Guard `@reformer/form-registry/guard` сравнивает штампы по идентичности: две независимо
 * загруженные копии ядра дают два разных объекта даже при одной версии — так распознаётся дубль
 * рантайма (раздвоенные модульные `WeakMap`). Здесь: штамп заморожен, корень пакета отдаёт тот же
 * объект, а вторая копия модуля — другой объект с тем же содержимым.
 */

import { describe, expect, it, vi } from 'vitest';
import { CORE_RUNTIME_TOKEN } from '../../../src/runtime-token';
import * as core from '../../../src/index';

describe('runtime-token — штамп копии ядра', () => {
  it('заморожен: свойства не меняются и не добавляются', () => {
    const token = CORE_RUNTIME_TOKEN as Record<string, unknown>;

    expect(Object.isFrozen(token)).toBe(true);
    expect(() => {
      token.v = 2;
    }).toThrow(TypeError);
    expect(() => {
      token.extra = true;
    }).toThrow(TypeError);
    expect(token).toEqual({ runtime: 'reformer-core', v: 1 });
  });

  it('корень @reformer/core отдаёт тот же объект', () => {
    expect(core.CORE_RUNTIME_TOKEN).toBe(CORE_RUNTIME_TOKEN);
  });

  it('независимо загруженная копия модуля — другой объект с тем же содержимым', async () => {
    vi.resetModules();

    const copy = await import('../../../src/runtime-token');

    expect(copy.CORE_RUNTIME_TOKEN).not.toBe(CORE_RUNTIME_TOKEN);
    expect(copy.CORE_RUNTIME_TOKEN).toEqual(CORE_RUNTIME_TOKEN);
  });
});
