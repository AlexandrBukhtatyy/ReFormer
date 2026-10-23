/**
 * Двойники платформы для юнитов моста.
 *
 * Порт ассистента (`./host`) держит ровно три глагола про рабочую область, поэтому двойник
 * получается маленьким — и это его главное свойство: тест моста не поднимает ни Workspace,
 * ни OPFS, ни оболочку, а поведение проверяет то же самое. Ровно ради этого платформа и
 * приходит портом, а не импортом.
 *
 * Файлы и документы — общие двойники (`.shared/assistant-fakes`): ими же пользуются тесты стеков.
 *
 * @module plugins/reformer/ai/testing
 */

import type { ResourceId } from '@reformer/builder-plugin-api';
import {
  createFakeDocuments,
  createFakeFiles,
  type FakeDocuments,
  type FakeFiles,
} from '../../../.shared/assistant-fakes';
import type { AiHost, Translate } from './host';

export { createFakeFiles, type FakeFiles };

/** Двойник рабочей области: карта документов, активная вкладка и журнал записей. */
export interface FakeHost
  extends AiHost, Pick<FakeDocuments, 'editOutside' | 'closeDocument' | 'writes' | 'failWrites'> {
  /** Положить (или заменить) содержимое документа и сделать его активным. */
  openDocument(id: ResourceId, text: string): void;
  setActive(id: ResourceId | null): void;
}

/** Ключ и параметры одной строкой: тест сверяет КЛЮЧ, а не перевод. */
const echoTranslate: Translate = (key, params) =>
  params === undefined ? key : `${key} ${JSON.stringify(params)}`;

/** Собрать двойник платформы. */
export function createFakeHost(files?: FakeFiles): FakeHost {
  const documents = createFakeDocuments(files);
  let active: ResourceId | null = null;

  return {
    useTranslate: () => echoTranslate,
    translate: echoTranslate,

    activeResource: () => active,
    documentOf: (id) => documents.documentOf(id),
    writeText: (id, text, mark) => documents.writeText(id, text, mark),

    ...(files ? { files } : {}),

    // Открыть документ, созданный мимо двойника (файлом): текст берётся из файлов, если они есть.
    async open(id) {
      const text = files === undefined ? null : await files.read(id);
      documents.openDocument(id, text ?? documents.documentOf(id)?.getText() ?? '');
      active = id;
    },

    openDocument(id, text) {
      documents.openDocument(id, text);
      active = id;
    },

    editOutside: (id, text) => {
      documents.editOutside(id, text);
    },

    closeDocument(id) {
      documents.closeDocument(id);
      if (active === id) active = null;
    },

    writes: documents.writes,

    failWrites: (error) => {
      documents.failWrites(error);
    },

    setActive(id) {
      active = id;
    },
  };
}
