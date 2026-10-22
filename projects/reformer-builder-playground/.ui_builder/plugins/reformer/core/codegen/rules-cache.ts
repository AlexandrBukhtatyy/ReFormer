/**
 * Кэш файлов правил для тех, кто спрашивает правила синхронно, — валидатора и редактора схемы.
 *
 * Их порты синхронные (проход валидатора, применимость команды), а файл правил читается
 * асинхронно. Поэтому промах кэша заказывает чтение и отвечает «пока не знаю», а когда текст
 * доехал или файл изменился (`onDidChange` рабочей области), кэш зовёт подписчиков — и те
 * перепроверяют документ. Плагины друг друга не импортируют, и у каждого свой экземпляр кэша:
 * дублируется только чтение маленького файла.
 *
 * Битый файл кэш отдаёт как «правил нет» — осиротевших правил в нём искать нечего, а о том, что
 * он не разбирается, говорят те, кто в него пишет (ассистент, генерация).
 *
 * @module plugins/reformer/core/codegen/rules-cache
 */

import type { Disposable, ResourceId } from '@reformer/builder-plugin-api';
import type { FormRules } from '../form-model/rules';
import { rulesSidecarNameOf } from './layout';
import { parseRulesText } from './rules-file';

/** Что кэшу нужно от рабочей области. */
export interface RulesCachePort {
  parentOf(id: ResourceId): ResourceId;
  resolve(dir: ResourceId, ...segments: readonly string[]): ResourceId;
  readText(id: ResourceId): Promise<string | null>;
  onDidChange(cb: (changed: readonly ResourceId[]) => void): Disposable;
}

export interface RulesCache {
  /** Адрес файла правил документа формы. */
  fileOf(document: ResourceId, documentPath: string): ResourceId;
  /**
   * Правила документа из кэша. Промах заказывает чтение и отвечает `undefined`; файла нет или он
   * битый — `null`.
   */
  get(document: ResourceId, documentPath: string): FormRules | null | undefined;
  /** Записали сами — кэш знает новый текст сразу, не дожидаясь события рабочей области. */
  remember(document: ResourceId, documentPath: string, text: string): void;
  /** Правила какого-то документа прочитаны заново и изменились. */
  onDidChange(cb: () => void): Disposable;
  dispose(): void;
}

interface Entry {
  /** Текст, по которому разобраны правила; `undefined` — чтение ещё в пути. */
  text: string | null | undefined;
  rules: FormRules | null;
}

const rulesOfText = (text: string | null): FormRules | null => {
  if (text === null) return null;
  const parsed = parseRulesText(text);
  return parsed.ok ? parsed.rules : null;
};

export function createRulesCache(port: RulesCachePort): RulesCache {
  const entries = new Map<ResourceId, Entry>();
  const listeners = new Set<() => void>();
  let disposed = false;

  const emit = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const settle = (id: ResourceId, text: string | null): void => {
    const entry = entries.get(id);
    if (disposed || entry === undefined || entry.text === text) return;
    const first = entry.text === undefined;
    entry.text = text;
    entry.rules = rulesOfText(text);
    // Первое чтение без правил ничего не меняет для подписчиков: до него они видели «правил
    // нет», и перепроверять документ ради того же ответа незачем.
    if (first && entry.rules === null) return;
    emit();
  };

  const load = (id: ResourceId): void => {
    void port.readText(id).then(
      (text) => settle(id, text),
      () => settle(id, null)
    );
  };

  const fileOf = (document: ResourceId, documentPath: string): ResourceId =>
    port.resolve(port.parentOf(document), rulesSidecarNameOf(documentPath));

  const watch = port.onDidChange((changed) => {
    for (const id of changed) if (entries.has(id)) load(id);
  });

  return {
    fileOf,
    get(document, documentPath) {
      const id = fileOf(document, documentPath);
      const entry = entries.get(id);
      if (entry !== undefined) return entry.text === undefined ? undefined : entry.rules;
      entries.set(id, { text: undefined, rules: null });
      load(id);
      return undefined;
    },
    remember(document, documentPath, text) {
      const id = fileOf(document, documentPath);
      if (!entries.has(id)) entries.set(id, { text: undefined, rules: null });
      settle(id, text);
    },
    onDidChange(cb) {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
    dispose() {
      disposed = true;
      watch.dispose();
      listeners.clear();
      entries.clear();
    },
  };
}
