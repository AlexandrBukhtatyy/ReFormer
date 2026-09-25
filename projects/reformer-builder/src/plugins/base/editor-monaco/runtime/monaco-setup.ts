/**
 * Отложенная загрузка Monaco: тяжёлое не попадает в главный чанк.
 *
 * Monaco — самая крупная зависимость приложения, а нужен он только когда открыт файл.
 * Динамический импорт делает его отдельным чанком, который Vite грузит при первом
 * открытии документа; оболочка, дерево ресурсов и палитра поднимаются без него.
 *
 * ## Почему именно так, а не `<Editor>` сразу
 *
 * `@monaco-editor/react` зовёт `loader.init()` на монтировании, и если к этому моменту
 * `loader.config({ monaco })` ещё не выполнен, он пойдёт за редактором **в сеть**. Гонка
 * тихая: с сетью всё работает, без неё — пустое место вместо редактора. Поэтому компонент
 * ждёт {@link ensureMonaco} и только потом рисует `<Editor>`.
 *
 * Промис запоминается: вкладок много, а настройка одна на приложение.
 *
 * @module plugins/base/editor-monaco/runtime/monaco-setup
 */

import type { JsonSchemaRegistry } from '../hints/json-schemas';
import type { MonacoApi } from './monaco-runtime';

/** Что даёт загруженный чанк: сам Monaco и реестр схем его языковой службы JSON. */
export interface MonacoRuntime {
  readonly monaco: MonacoApi;
  readonly jsonSchemas: JsonSchemaRegistry;
}

let pending: Promise<MonacoRuntime> | null = null;

/**
 * Загружает и настраивает Monaco. Повторный вызов отдаёт тот же промис.
 *
 * Отказ НЕ запоминается: сорванная загрузка чанка (обрыв сети при первом открытии) —
 * состояние временное, и запомненный отказ означал бы, что редактор не поднимется
 * до перезагрузки страницы.
 */
export function ensureMonaco(): Promise<MonacoApi> {
  return ensureMonacoRuntime().then((runtime) => runtime.monaco);
}

/**
 * То же, что {@link ensureMonaco}, вместе с реестром схем: он живёт в том же чанке, потому что
 * держит `jsonDefaults`, а статический импорт утащил бы Monaco в главный чанк.
 */
export function ensureMonacoRuntime(): Promise<MonacoRuntime> {
  pending ??= import('./monaco-runtime')
    .then((runtime) => ({ monaco: runtime.monaco, jsonSchemas: runtime.jsonSchemas }))
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}
