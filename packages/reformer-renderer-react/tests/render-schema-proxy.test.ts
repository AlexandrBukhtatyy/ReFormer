/**
 * Regression (defect #63): пер-selector version-сигналы вместо единого глобального счётчика.
 *
 * До фикса setHidden/patchProps любой ноды бампали ОДИН глобальный `version`, на который были
 * подписаны ВСЕ ноды дерева → O(N) notify на одно точечное переопределение. После фикса нода
 * подписывается только на сигнал СВОЕГО selector (`versionFor(selector)`), поэтому уведомляется
 * ровно одна затронутая нода (O(1)).
 *
 * Проверяется через публичные override-maps без DOM/рендера.
 */
import { describe, it, expect } from 'vitest';
import { createRenderSchema } from '../src/core/render-schema-proxy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trivialSchema = () => ({ component: (() => null) as any, children: [] });

describe('createRenderSchema — пер-selector version-сигналы (defect #63)', () => {
  it('versionFor(selector) возвращает стабильный сигнал на selector', () => {
    const schema = createRenderSchema(trivialSchema);
    const a1 = schema.__overrideMaps.versionFor('a');
    const a2 = schema.__overrideMaps.versionFor('a');
    const b = schema.__overrideMaps.versionFor('b');
    expect(a1).toBe(a2); // тот же selector → тот же сигнал (ленивое создание кэшируется)
    expect(a1).not.toBe(b); // разные selector'ы → разные сигналы
  });

  it('setHidden бампает ТОЛЬКО сигнал своего selector, не соседей (O(1) fan-out)', () => {
    const schema = createRenderSchema(trivialSchema);
    const sigA = schema.__overrideMaps.versionFor('a');
    const sigB = schema.__overrideMaps.versionFor('b');
    const a0 = sigA.value;
    const b0 = sigB.value;

    schema.node('a').setHidden(true);

    expect(sigA.value).toBe(a0 + 1); // затронутая нода уведомлена
    expect(sigB.value).toBe(b0); // соседняя нода НЕ уведомлена
  });

  it('patchProps / resetProps / resetHidden изолированы по selector', () => {
    const schema = createRenderSchema(trivialSchema);
    const sigA = schema.__overrideMaps.versionFor('a');
    const sigB = schema.__overrideMaps.versionFor('b');
    const b0 = sigB.value;

    schema.node('a').patchProps({ title: 'x' });
    schema.node('a').resetProps();
    schema.node('a').resetHidden();

    expect(sigA.value).toBe(3); // три мутации ноды 'a'
    expect(sigB.value).toBe(b0); // 'b' не тронут ни разу
  });

  it('глобальный version по-прежнему бампается (обратная совместимость)', () => {
    const schema = createRenderSchema(trivialSchema);
    const v0 = schema.__overrideMaps.version.value;

    schema.node('a').setHidden(true);
    schema.node('b').patchProps({ y: 1 });

    expect(schema.__overrideMaps.version.value).toBe(v0 + 2);
  });
});
