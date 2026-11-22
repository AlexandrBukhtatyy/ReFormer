/**
 * Компилятор intent — грамматика и судья `build_form` в сервисе ReFormer.
 *
 * Грамматика под кит, вердикт судьи и документ раскладки (`buildSchemaLayout`) считает сервис:
 * `intent_grammar` и `judge_intent` поверхности `builder`. Здесь — их клиент: каталог кита идёт по
 * отпечатку (около мегабайта — не в каждый вызов), грамматика кэшируется по нему же.
 *
 * Типы находок судьи — свои: контракт сервиса — JSON, а не типы закрытого пакета. Сам intent и
 * документ раскладки — типы открытого `@reformer/form-intent`.
 *
 * @module plugins/reformer/ai/service/compiler
 */

import type { FormIntent, SchemaDocument } from '@reformer/form-intent';
import type { Catalog } from '../model/catalog-digest';
import type { ServiceCall, ServiceOutcome } from './link';

/** Находка судьи: код, место, что не так и что сделать. */
export interface JudgeFinding {
  readonly code: string;
  readonly message: string;
  /** Место в intent (`fields[2].lable`), когда оно известно. */
  readonly at?: string;
  readonly hint?: string;
}

/** Грамматика intent под кит. */
export interface IntentGrammar {
  readonly grammar: string;
  /** Имена полей и массивов образца грамматики — по ним узнаётся intent, списанный с образца. */
  readonly sampleNames: readonly string[];
}

/** Вердикт судьи для документа билдера. */
export interface IntentVerdict {
  /** Intent прочитан не целиком: других ошибок судья не дал, и своих проверок сборке не добавлять. */
  readonly unread: boolean;
  readonly errors: readonly JudgeFinding[];
  readonly warnings: readonly JudgeFinding[];
  readonly intent: FormIntent;
  /** Документ раскладки intent — по нему сборка ставит узлы. */
  readonly document: SchemaDocument;
  readonly sampleNames: readonly string[];
}

export interface FormCompiler {
  grammar(catalog: Catalog, signal?: AbortSignal): Promise<ServiceOutcome<IntentGrammar>>;
  judge(
    intent: unknown,
    catalog: Catalog,
    signal?: AbortSignal
  ): Promise<ServiceOutcome<IntentVerdict>>;
}

/** Ответ сервиса, которому не хватило каталога: он не помнит такого отпечатка. */
interface NeedCatalog {
  readonly needCatalog: true;
}

const needsCatalog = (value: unknown): value is NeedCatalog =>
  typeof value === 'object' && value !== null && (value as NeedCatalog).needCatalog === true;

/** Отпечаток каталога: sha256 его JSON. */
async function fingerprint(catalog: Catalog): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(catalog));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Клиент компилятора над вызовом сервиса. */
export function createFormCompiler(call: ServiceCall): FormCompiler {
  /** Отпечатки — по объекту каталога: каталог кита меняется заменой, а не правкой. */
  const hashes = new WeakMap<Catalog, Promise<string>>();
  const grammars = new Map<string, Promise<ServiceOutcome<IntentGrammar>>>();

  const hashOf = (catalog: Catalog): Promise<string> => {
    let hash = hashes.get(catalog);
    if (hash === undefined) {
      hash = fingerprint(catalog);
      hashes.set(catalog, hash);
    }
    return hash;
  };

  /** Вызов с каталогом по отпечатку; сервис не помнит его — повтор с самим каталогом. */
  const withCatalog = async <T>(
    tool: string,
    args: Record<string, unknown>,
    catalog: Catalog,
    signal?: AbortSignal
  ): Promise<ServiceOutcome<T>> => {
    const catalogHash = await hashOf(catalog);
    const first = await call<T | NeedCatalog>(tool, { ...args, catalogHash }, signal);
    if (!first.ok || !needsCatalog(first.value)) return first as ServiceOutcome<T>;
    const second = await call<T | NeedCatalog>(tool, { ...args, catalogHash, catalog }, signal);
    if (second.ok && needsCatalog(second.value)) {
      return { ok: false, message: `The ReFormer service did not take the kit catalog (${tool}).` };
    }
    return second as ServiceOutcome<T>;
  };

  return {
    async grammar(catalog, signal) {
      const hash = await hashOf(catalog);
      let grammar = grammars.get(hash);
      if (grammar === undefined) {
        grammar = withCatalog<IntentGrammar>('intent_grammar', {}, catalog, signal);
        grammars.set(hash, grammar);
        // Неудача не запоминается: следующий ход спросит снова.
        void grammar.then((outcome) => {
          if (!outcome.ok) grammars.delete(hash);
        });
      }
      return grammar;
    },
    judge: (intent, catalog, signal) =>
      withCatalog<IntentVerdict>('judge_intent', { intent }, catalog, signal),
  };
}
