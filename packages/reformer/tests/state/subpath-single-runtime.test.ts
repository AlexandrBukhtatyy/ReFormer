/**
 * Cross-entry single-runtime гарантия для subpath `@reformer/core/state`.
 *
 * Проверяет на СОБРАННОМ dist, что зонтичный barrel `.` (`dist/index.js`), subpath `/state`
 * (`dist/state.js`) и рантайм `/signals` (`dist/signals.js`) резолвятся в ОДИН module-инстанс:
 * единая идентичность класса `Signal` и общий `derived`-WeakMap. Если бы бандлер продублировал
 * код в разные чанки, `markDerived` из `/state` не влиял бы на bulk-set модели, созданной через `.`
 * (или `Signal` из `/signals` не совпал бы с сигналом модели) — и тест бы упал.
 *
 * `Signal` живёт в `/signals` (не в `/state`: state-субстрат рантайм не реэкспортирует).
 *
 * Тест работает против dist (именно там возможна дупликация чанков; на уровне src оба entry
 * тривиально ссылаются на один модуль). Пропускается, если пакет не собран (`npm run build`).
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Локальные структурные типы: тест не привязан к .d.ts из dist (может отсутствовать при typecheck).
interface Sig {
  peek(): unknown;
  value: unknown;
}
interface Model {
  $: Record<string, Sig>;
  set(v: Record<string, unknown>): void;
  get(): Record<string, unknown>;
}
interface CoreEntry {
  createModel(init: Record<string, unknown>): Model;
}
interface StateEntry {
  markDerived(s: unknown): void;
  isDerived(s: unknown): boolean;
}
interface SignalsEntry {
  Signal: new (...args: never[]) => unknown;
}

const distIndex = resolve(__dirname, '../../dist/index.js');
const distState = resolve(__dirname, '../../dist/state.js');
const distSignals = resolve(__dirname, '../../dist/signals.js');
const built = existsSync(distIndex) && existsSync(distState) && existsSync(distSignals);

(built ? describe : describe.skip)(
  '@reformer/core/state — single-runtime across entries (dist)',
  () => {
    it('./ /state / /signals делят Signal-идентичность и один derived-реестр', async () => {
      const core = (await import(pathToFileURL(distIndex).href)) as unknown as CoreEntry;
      const state = (await import(pathToFileURL(distState).href)) as unknown as StateEntry;
      const signals = (await import(pathToFileURL(distSignals).href)) as unknown as SignalsEntry;

      const model = core.createModel({ x: '', y: 0 });
      const sig = model.$.x;

      // 1. Единая идентичность класса Signal: сигнал модели (из `.`) — instanceof Signal из `/signals`.
      expect(sig instanceof signals.Signal).toBe(true);

      // 2. Общий derived-реестр: пометка через /state видна через /state.
      state.markDerived(sig);
      expect(state.isDerived(sig)).toBe(true);

      // 3. Ключевое: bulk-set модели, созданной через `.`, консультирует ТОТ ЖЕ реестр —
      //    производное поле не затирается, обычное — обновляется.
      model.set({ x: 'CHANGED', y: 42 });
      expect(model.get().x).toBe(''); // derived skip (пометка из /state уважается '.'-путём)
      expect(model.get().y).toBe(42); // обычное поле записалось
    });
  }
);
