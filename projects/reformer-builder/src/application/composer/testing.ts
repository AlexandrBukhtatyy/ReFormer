/**
 * Возможности оболочки для проверок состава — один стенд на всех, кто плагины активирует.
 *
 * Проверки состава спрашивают у композиции одно и то же: КТО собрался и что он внёс. Портов
 * у встроенных плагинов больше нет — всё, что им нужно, они берут из реестра служб, — поэтому
 * стенд держит только сами службы.
 *
 * Не `*.test.ts` намеренно: файл импортируют тесты из ДРУГИХ каталогов
 * (`shell/boot/integration`), а тест — не модуль, на который ссылаются. Цена в том, что файл
 * попадает под храповик «стартовый граф не импортирует барель ленивого плагина значением»
 * наравне с рабочим кодом; здесь это ровно то, что нужно.
 *
 * @module application/composer/testing
 */

import type { ServiceRegistry } from '@reformer/builder-plugin-api/internal';
import { DocumentsServiceToken } from '@reformer/builder-plugin-api/internal';
import { WorkspaceFilesServiceToken } from '@reformer/builder-plugin-api/internal';
import { createDocumentModelsService } from '@/shell/boot/ports/document-models';
import { createDocumentsService } from '@/shell/boot/ports/documents';
import { createWorkspaceFilesService } from '@/shell/boot/ports/workspace-files';
import { createEditorViewStates } from '@/shell/platform/workspace/model/editor-view-states';
import { EditorViewStatesToken } from '@reformer/builder-plugin-api/internal';
import { createTextEditorFocusRegistry } from '@/shell/platform/workspace/model/text-editor-focus';
import { TextEditorFocusToken } from '@reformer/builder-plugin-api/internal';
import { DocumentModelsCapability } from '@reformer/builder-plugin-api/internal';

/**
 * Возможности оболочки, без которых встроенные плагины не поднимаются, — как в `boot`.
 *
 * Ни одна не пустышка. Реестр фокуса и хранилище снимков вида настоящие, потому что
 * подделывать в них нечего — это карта и множество. Службы рабочей области тоже настоящие,
 * но над ЗАКРЫТЫМ проектом: держатель отвечает `null`, и обе службы честно дают `null`,
 * `false` и пустой список. Это не обеднённый стенд, а состояние приложения сразу после
 * запуска — то самое, в котором плагины и активируются на самом деле.
 *
 * Вызывается стендом, который плагины АКТИВИРУЕТ. Тому, кто их только создаёт, не нужно:
 * службы спрашиваются в `activate`.
 */
export function stubHostCapabilities(services: ServiceRegistry): void {
  const closed = { get: () => null, subscribe: () => ({ dispose: () => {} }) };
  services.register(TextEditorFocusToken, createTextEditorFocusRegistry());
  services.register(EditorViewStatesToken, createEditorViewStates());
  services.register(DocumentsServiceToken, createDocumentsService({ project: closed }));
  services.register(WorkspaceFilesServiceToken, createWorkspaceFilesService({ project: closed }));
  services.register(DocumentModelsCapability, createDocumentModelsService({ project: closed }));
}
