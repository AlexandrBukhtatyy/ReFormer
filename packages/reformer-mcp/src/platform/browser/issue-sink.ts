/**
 * Сток отчётов `report_issue` для браузера — в память вкладки.
 *
 * Почему не IndexedDB напрямую. Порт {@link IssueSink} синхронный, а IndexedDB асинхронна;
 * писать в неё «в фоне» и сразу отвечать «сохранено» значило бы врать: отказ квоты или
 * приватного окна остался бы невидимым, а инструмент уже отчитался об успехе. Поэтому сток
 * копит записи синхронно и честно, а сохранить их куда-то долговечно — решение хоста: он
 * знает, есть ли у него хранилище, и может показать отказ пользователю.
 *
 * Отчёты — лог находок агента, а не данные пользователя: потерять их при закрытии вкладки
 * неприятно, но не разрушительно. Именно поэтому такой размен допустим.
 *
 * @module reformer-mcp/platform/browser/issue-sink
 */

import type { IssueSink } from '../../core/issues/sink.js';

export interface MemoryIssueSink extends IssueSink {
  /** Накопленные отчёты: имя (без расширения) → содержимое JSON. */
  entries(): ReadonlyMap<string, string>;
  /** Забыть накопленное — после того как хост их куда-то сохранил. */
  clear(): void;
}

export function createMemoryIssueSink(label = 'памяти вкладки'): MemoryIssueSink {
  const store = new Map<string, string>();

  return {
    location: () => label,

    write(baseName, payload) {
      // Тот же приём против коллизий, что на диске: два отчёта в одну миллисекунду с одним
      // слагом получают разные имена, а не затирают друг друга.
      let name = baseName;
      for (let attempt = 2; store.has(name); attempt++) name = `${baseName}-${attempt}`;
      store.set(name, payload);
      return `${label} (${name}.json)`;
    },

    entries: () => store,
    clear: () => store.clear(),
  };
}
