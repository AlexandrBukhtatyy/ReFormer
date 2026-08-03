/**
 * ЛОКАЛЬНАЯ настройка Monaco (спека §8) — без CDN. Бандлим ядро monaco + JSON-контрибуцию +
 * web-воркеры (через Vite `?worker`) и говорим @monaco-editor/react использовать наш инстанс
 * (`loader.config`). Подключаем JSON-схему формы (проектная мета-схема из каталога, fallback —
 * generic) для валидации/автокомплита прямо в редакторе.
 *
 * monaco 0.56 (ESM): языковые сервисы подключаются отдельной контрибуцией, а deep-импорты
 * требуют суффикс `.js` (exports-map `./*.js`). Побочные эффекты выполняются при импорте
 * (до монтирования редактора).
 *
 * @module reformer-builder/canvas/monaco-setup
 */

// Только core-редактор (без 50+ языков-дефиниций) + JSON — иначе главный чанк раздувается языками.
// exports-map monaco: `./*` → `./esm/vs/*.js`, поэтому специфаер БЕЗ `esm/vs/` и БЕЗ `.js`.
import * as monaco from 'monaco-editor/editor/editor.api';
import { jsonDefaults } from 'monaco-editor/language/json/monaco.contribution';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';
import { loader } from '@monaco-editor/react';
import { buildFormSchemaMetaSchema, formSchemaMetaSchema } from '@reformer/renderer-json';
import { getCatalog } from '../catalog';

function metaSchema(): object {
  try {
    const catalog = getCatalog();
    const componentNames = catalog.filter((e) => !e.name.startsWith('$html(')).map((e) => e.name);
    const propSchemas = Object.fromEntries(catalog.map((e) => [e.name, e.propsSchema]));
    return buildFormSchemaMetaSchema({ componentNames, propSchemas }) as object;
  } catch {
    return formSchemaMetaSchema as object;
  }
}

// Web-воркеры Monaco (только JSON + базовый редактор), бандлятся Vite'ом локально.
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker(_id: string, label: string): Worker {
    return label === 'json' ? new jsonWorker() : new editorWorker();
  },
};

// @monaco-editor/react использует НАШ локальный monaco (без загрузки с CDN).
loader.config({ monaco });

// JSON-схема формы → подсказки/валидация прямо в редакторе.
jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: false,
  enableSchemaRequest: false,
  schemas: [
    {
      uri: 'inmemory://reformer-builder/form-schema.json',
      fileMatch: ['*'],
      schema: metaSchema(),
    },
  ],
});
