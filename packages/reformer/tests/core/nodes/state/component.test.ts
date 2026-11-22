/**
 * Модуль состояния компонента (`createComponentState`) сам по себе: пропсы из узла схемы и правки
 * поверх них (`updateComponentProps` поля).
 *
 * Правка сливается поверх текущих пропсов и даёт новый объект — прежний снимок не мутируется, и
 * подписчики видят смену по идентичности. Правка читает текущие пропсы без подписки: вызов внутри
 * эффекта не делает эффект зависимым от пропсов (иначе эффект, правящий пропсы, зациклился бы).
 */

import { describe, expect, it } from 'vitest';
import { batch, effect, signal, type Signal } from '@preact/signals-core';
import { createComponentState } from '../../../../src/form/nodes/state/component';
import { createModel } from '../../../../src/model/index';

describe('component — пропсы и правки поверх них', () => {
  it('начальные пропсы отдаются как переданы, без них — пустой объект', () => {
    const initial = { label: 'Email' };

    expect(createComponentState(initial).props.value).toBe(initial);
    expect(createComponentState().props.value).toEqual({});
  });

  it('update сливает правку: новые ключи добавляются, совпавшие перезаписываются', () => {
    const state = createComponentState({ label: 'Email', required: true });

    state.update({ label: 'E-mail', placeholder: 'name@mail.com' });

    expect(state.props.value).toEqual({
      label: 'E-mail',
      required: true,
      placeholder: 'name@mail.com',
    });
  });

  it('update даёт новый объект: прежний снимок и начальный объект не мутируются', () => {
    const initial = { label: 'Email' };
    const state = createComponentState(initial);
    const before = state.props.value;

    state.update({ label: 'Логин' });

    expect(state.props.value).not.toBe(before);
    expect(before).toEqual({ label: 'Email' });
    expect(initial).toEqual({ label: 'Email' });
  });

  it('ключ правкой не удаляется: undefined записывается как значение', () => {
    const state = createComponentState({ hint: 'подсказка' });

    state.update({ hint: undefined });

    expect(state.props.value).toHaveProperty('hint', undefined);
  });

  it('правки подряд накапливаются, в batch подписчик видит одну итоговую смену', () => {
    const state = createComponentState({});
    const seen: unknown[] = [];
    const stop = effect(() => {
      seen.push(state.props.value);
    });

    batch(() => {
      state.update({ a: 1 });
      state.update({ b: 2 });
    });
    stop();

    expect(seen).toEqual([{}, { a: 1, b: 2 }]);
  });

  it('update внутри эффекта не подписывает эффект на пропсы', () => {
    const state = createComponentState({ options: [] });
    const source = signal(0);
    let runs = 0;
    const stop = effect(() => {
      runs++;
      state.update({ revision: source.value });
    });

    source.value = 1;
    state.update({ options: ['a'] });
    stop();

    // Перезапуск — только от source: правка пропсов извне эффект не будит.
    expect(runs).toBe(2);
    expect(state.props.value).toEqual({ options: ['a'], revision: 1 });
  });

  it('наружу — только чтение: пропсы правятся через update', () => {
    const state = createComponentState({ label: 'Email' });

    expect(() => {
      (state.props as Signal<Record<string, unknown>>).value = {};
    }).toThrow(TypeError);
    expect(state.props.value).toEqual({ label: 'Email' });
  });
});

describe('component — пропс-сигнал вне модели отдаётся значением [ReFormer-zh9r]', () => {
  it('сигнал в пропсах — его значение; смена сигнала даёт новый снимок пропсов', () => {
    const options: Signal<string[]> = signal([]);
    const state = createComponentState({ label: 'Тип', options });
    const seen: unknown[] = [];
    const stop = effect(() => {
      seen.push(state.props.value.options);
    });

    options.value = ['дом', 'квартира'];
    stop();

    expect(state.props.value).toEqual({ label: 'Тип', options: ['дом', 'квартира'] });
    expect(seen).toEqual([[], ['дом', 'квартира']]);
  });

  it('ручка модели — привязка, а не значение: доходит как есть', () => {
    const model = createModel({ amount: 0, address: { city: '' } });
    const state = createComponentState({ leaf: model.$.amount, group: model.$.address });

    expect(state.props.value.leaf).toBe(model.$.amount);
    expect(state.props.value.group).toBe(model.$.address);
  });

  it('правка значением заменяет сигнал, правка сигналом — подписывает на него', () => {
    const first = signal(['a']);
    const second = signal(['b']);
    const state = createComponentState({ options: first });

    state.update({ options: ['вручную'] });
    expect(state.props.value.options).toEqual(['вручную']);

    state.update({ options: second });
    second.value = ['c'];
    expect(state.props.value.options).toEqual(['c']);
  });
});
