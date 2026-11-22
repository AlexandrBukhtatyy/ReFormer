/**
 * Кэш правил формы из кода её модуля — для тех, кто спрашивает правила синхронно: валидатора и
 * редактора схемы.
 *
 * Их порты синхронные (проход валидатора, применимость команды), а код модуля читается
 * асинхронно. Поэтому промах кэша заказывает чтение и отвечает «пока не знаю», а когда тексты
 * доехали или файл правил изменился (`onDidChange` рабочей области), кэш зовёт подписчиков — и
 * те перепроверяют документ. Плагины друг друга не импортируют, и у каждого свой экземпляр кэша:
 * дублируется только чтение нескольких маленьких файлов.
 *
 * Читает кэш код правил модуля (`./rules-code`) — тот же, что генерация и ассистент. Перечитывает
 * модуль, когда меняется прочитанный файл либо в прочитанном каталоге появляется новый: файл шага
 * называется заголовком шага, и переименованный шаг — это новый файл.
 *
 * @module plugins/reformer/core/codegen/rules-cache
 */

import type { Disposable, ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
import type { FormRules } from '../form-model/rules';
import { FORM_RULES_NAME, moduleRootOfDocument, VALIDATION_DIR } from './layout';
import { loadRulesFromModule } from './rules-code';

/** Что кэшу нужно от рабочей области. */
export interface RulesCachePort {
  parentOf(id: ResourceId): ResourceId;
  resolve(dir: ResourceId, ...segments: readonly string[]): ResourceId;
  readText(id: ResourceId): Promise<string | null>;
  /** Один уровень каталога; нет — читается только файл правил формы. */
  list?(dir: ResourceId): Promise<readonly ResourceRef[]>;
  onDidChange(cb: (changed: readonly ResourceId[]) => void): Disposable;
}

export interface RulesCache {
  /** Корень модуля формы документа — там живёт её код. */
  rootOf(document: ResourceId, documentPath: string): ResourceId;
  /**
   * Правила документа из кэша. Промах заказывает чтение и отвечает `undefined`; правил в коде
   * нет (или модуля нет) — `null`.
   */
  get(document: ResourceId, documentPath: string): FormRules | null | undefined;
  /** Правила какого-то документа прочитаны заново и изменились. */
  onDidChange(cb: () => void): Disposable;
  dispose(): void;
}

interface Entry {
  /** Правила; `undefined` — чтение ещё в пути. */
  rules: FormRules | null | undefined;
  /** Слепок правил — им сравнивается перечитанное. */
  key: string | undefined;
  /** Прочитанные файлы — их правка перечитывает модуль. */
  read: Set<ResourceId>;
  /** Прочитанные каталоги — новый файл в них перечитывает модуль. */
  dirs: Set<ResourceId>;
  /** Номер чтения: доехавшее старое чтение не затирает новое. */
  generation: number;
}

/** В правилах нет ни одного правила и значения — для подписчиков это «правил нет». */
function isEmpty(rules: FormRules): boolean {
  return (
    rules.validation.length + rules.behavior.length + rules.render.length === 0 &&
    Object.keys(rules.dataSources ?? {}).length === 0
  );
}

export function createRulesCache(port: RulesCachePort): RulesCache {
  const entries = new Map<ResourceId, Entry>();
  const listeners = new Set<() => void>();
  let disposed = false;

  const emit = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const load = (root: ResourceId, entry: Entry): void => {
    entry.generation += 1;
    const generation = entry.generation;
    const read = new Set<ResourceId>();
    const dirs = new Set<ResourceId>();
    const at = (path: string) => port.resolve(root, ...path.split('/'));
    const list = port.list;
    void loadRulesFromModule(
      {
        read: async (path) => {
          const id = at(path);
          read.add(id);
          return port.readText(id).catch(() => null);
        },
        ...(list === undefined
          ? {}
          : {
              list: async (dir: string) => {
                const id = at(dir);
                dirs.add(id);
                const children = await list(id).catch(() => null);
                return children === null
                  ? null
                  : children
                      .filter((child) => child.kind !== 'directory')
                      .map((child) => child.name);
              },
            }),
      },
      { validation: [`${VALIDATION_DIR}/${FORM_RULES_NAME}.ts`] }
    ).then(
      (code) => settle(entry, generation, read, dirs, isEmpty(code.rules) ? null : code.rules),
      () => settle(entry, generation, read, dirs, null)
    );
  };

  const settle = (
    entry: Entry,
    generation: number,
    read: Set<ResourceId>,
    dirs: Set<ResourceId>,
    rules: FormRules | null
  ): void => {
    if (disposed || entry.generation !== generation) return;
    entry.read = read;
    entry.dirs = dirs;
    const key = JSON.stringify(rules);
    const first = entry.rules === undefined;
    if (!first && entry.key === key) return;
    entry.rules = rules;
    entry.key = key;
    // Первое чтение без правил ничего не меняет для подписчиков: до него они видели «правил
    // нет», и перепроверять документ ради того же ответа незачем.
    if (first && rules === null) return;
    emit();
  };

  const rootOf = (document: ResourceId, documentPath: string): ResourceId =>
    moduleRootOfDocument(port, document, documentPath);

  const watch = port.onDidChange((changed) => {
    for (const [root, entry] of entries) {
      const touched = changed.some((id) => entry.read.has(id) || entry.dirs.has(port.parentOf(id)));
      if (touched) load(root, entry);
    }
  });

  return {
    rootOf,
    get(document, documentPath) {
      const root = rootOf(document, documentPath);
      const entry = entries.get(root);
      if (entry !== undefined) return entry.rules;
      const fresh: Entry = {
        rules: undefined,
        key: undefined,
        read: new Set(),
        dirs: new Set(),
        generation: 0,
      };
      entries.set(root, fresh);
      load(root, fresh);
      return undefined;
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
