/**
 * Совместимостный фасад над корпусом документации.
 *
 * Логика уехала в `core/docs/*` (разбор, кэши) и `platform/cli/docs-source.ts` (диск). Здесь
 * остался прежний API поверх ОДНОГО корпуса на CLI-источнике — ровно то, чем этот модуль был
 * раньше, включая модульный кэш.
 *
 * Фасад временный. Он существует, чтобы расщепление загрузчиков не пришлось делать одним
 * коммитом вместе с переводом двенадцати потребителей на фабрику `createKnowledge`: пока они
 * зовут прежние функции, ядро уже не знает о файловой системе. Удаляется вместе с последним
 * потребителем.
 *
 * @module reformer-mcp/utils/docs-parser
 */

import { cliKnowledge } from '../platform/cli/knowledge.js';
import { DEFAULT_PACKAGE, type ReformerPackage } from '../core/docs/packages.js';

export { KNOWN_PACKAGES, type ReformerPackage } from '../core/docs/packages.js';
export { normalizeTopic } from '../core/docs/sections.js';

/**
 * Корпус берётся из знания процесса, а не создаётся здесь: иначе у сервера было бы два
 * независимых кэша документации — этот и тот, что видят инструменты через `Knowledge`.
 */
const corpus = () => cliKnowledge().docs;

/** Полная документация одного пакета. */
export function getFullDocs(pkg: string = DEFAULT_PACKAGE): string {
  return corpus().full(pkg);
}

/** Пакеты, у которых `llms.txt` доступен. */
export function listAvailablePackages(): ReformerPackage[] {
  return corpus().packages();
}

/** Секции уровня 2 пакета. */
export function listSections(pkg: string) {
  return corpus().sections(pkg);
}

/** Тело секции по слагу; `null` — слаг неизвестен. */
export function getSectionBySlug(pkg: string, slug: string): string | null {
  return corpus().sectionBySlug(pkg, slug);
}
