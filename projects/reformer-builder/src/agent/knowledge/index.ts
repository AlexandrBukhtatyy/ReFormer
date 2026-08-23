/**
 * Корпус знаний о ReFormer — тот же, что у MCP-сервера, но собранный для браузера.
 *
 * Артефакт (`generated/knowledge-index.json` и `knowledge-docs.json`) генерируется при сборке
 * из `llms.txt` и `llms-index.json` установленных пакетов, и в git
 * не коммитится: его версия обязана совпадать со сборкой, а не с моментом, когда его последний
 * раз обновили руками.
 *
 * Импорт ОБЯЗАТЕЛЬНО динамический — по той же причине, по которой динамически грузятся киты
 * (`kits/registry.ts`): статический положил бы 2.8 МБ JSON в основной чанк, и за них платил бы
 * размером первого экрана каждый, кто ассистентом не пользуется.
 *
 * Документация грузится отдельно от индекса и параллельно с ним. Индекс (264 кБ gzip) питает
 * решение по API и сигнатуры; проза (362 кБ) нужна только полнотекстовому поиску. Слитые в один
 * файл, они парсились бы вместе даже когда нужен один.
 *
 * @module reformer-builder/agent/knowledge
 */

import { createBrowserKnowledge } from '@reformer/mcp/browser';
import type { Knowledge } from '@reformer/mcp/dist/core/knowledge.js';

let cached: Promise<Knowledge | null> | null = null;

/**
 * Знание для этой вкладки. `null` — артефакта нет (сборка без `generate:knowledge`), и это не
 * повод падать: ассистент обязан работать без справки, просто без неё.
 */
export function loadKnowledge(): Promise<Knowledge | null> {
  return (cached ??= build());
}

async function build(): Promise<Knowledge | null> {
  try {
    const [index, docs] = await Promise.all([
      import('./generated/knowledge-index.json'),
      import('./generated/knowledge-docs.json'),
    ]);
    return createBrowserKnowledge({
      index: (index.default ?? index) as never,
      docs: (docs.default ?? docs) as never,
    }).knowledge;
  } catch (error) {
    // Отсутствие артефакта — состояние сборки, а не ошибка выполнения. Молчать нельзя: без
    // этой строки «ассистент не отвечает про библиотеку» выглядело бы как баг модели.
    console.warn(
      '[reformer-builder] корпус знаний не загружен — справка по библиотеке недоступна. ' +
        'Соберите его: npm run generate:knowledge',
      error
    );
    return null;
  }
}

/** Только для тестов — забыть загруженное. */
export function __resetKnowledge(): void {
  cached = null;
}
