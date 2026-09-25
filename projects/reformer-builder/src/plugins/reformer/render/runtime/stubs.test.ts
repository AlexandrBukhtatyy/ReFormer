/**
 * Изоляция компонента реестра превью не должна стирать его статики-контракты.
 *
 * Потеря статики не видна ни в типах, ни в отрисовке по отдельности: обёртка рисуется, контрол
 * рисуется, а поле молча переходит на чужой диалект. Так и случилось 19.09, когда адаптеры
 * контролов кита переехали в статику `reformerAdapter`, а список копируемых статик остался
 * прежним. Храповик ниже сверяет список с тем, что ФАКТИЧЕСКИ несут экспорты встроенного кита:
 * новая статика в ките уронит тест раньше, чем форму в превью.
 *
 * @module plugins/reformer/render/runtime/stubs.test
 */

import { describe, expect, it } from 'vitest';
import * as uiKit from '@reformer/ui-kit';
import { getFieldAdapter } from '@reformer/core';
import { CONTRACT_STATICS, isolateComponent } from './stubs';

/** Собственные ключи-контракты компонента: то, по чему его узнают рендерер и кит. */
function contractKeys(component: unknown): string[] {
  if (component === null || (typeof component !== 'function' && typeof component !== 'object')) {
    return [];
  }
  return Object.keys(component).filter(
    (key) => key.startsWith('reformer') || key === '__selfManagedChildren'
  );
}

describe('isolateComponent', () => {
  it('переносит каждую статику-контракт на обёртку', () => {
    const adapter = { valueProp: 'checked' };
    const component = Object.assign(() => null, {
      __selfManagedChildren: true,
      reformerNeedsControl: true,
      reformerLayout: 'inline-label',
      reformerAdapter: adapter,
    });
    const isolated = isolateComponent(component, 'Probe') as unknown as Record<string, unknown>;
    const source = component as unknown as Record<string, unknown>;
    for (const key of CONTRACT_STATICS) {
      expect(isolated[key], key).toBe(source[key]);
    }
  });

  it('адаптер контрола встроенного кита виден и на обёртке', () => {
    for (const name of ['Input', 'Checkbox'] as const) {
      const control = uiKit[name];
      const adapter = getFieldAdapter(control);
      expect(adapter, name).toBeDefined();
      expect(getFieldAdapter(isolateComponent(control, name)), name).toBe(adapter);
    }
  });

  it('копирует все статики-контракты, какие есть у экспортов встроенного кита', () => {
    const seen = new Set<string>();
    for (const value of Object.values(uiKit)) {
      for (const key of contractKeys(value)) seen.add(key);
    }
    // Проверка осмысленна, только если кит вообще несёт статики: иначе храповик пуст.
    expect(seen.has('reformerAdapter')).toBe(true);
    expect([...seen].filter((key) => !CONTRACT_STATICS.includes(key))).toEqual([]);
  });
});
