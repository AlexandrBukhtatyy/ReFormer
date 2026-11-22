/**
 * Справка по библиотеке и проверка кода — из сервиса ReFormer: `ask_reformer` и `check_code`
 * поверхности `builder`.
 *
 * Корпус знаний — у сервиса, в плагин он больше не вшит. Сервис недоступен (нет ключа, плагина MCP
 * или сети) — справка отвечает `null`: модель узнает словами, что справки нет, а запись режима
 * файлов пройдёт с замечанием, что код проверить нечем.
 *
 * @module plugins/reformer/ai/service/reference
 */

import type { CodeFinding, LibraryReferenceService } from '../reference';
import type { ServiceCall } from './link';

/** Справка поверх вызова сервиса. */
export function createServiceReference(call: ServiceCall): Required<LibraryReferenceService> {
  return {
    async ask(question, request) {
      const outcome = await call<{ text: string }>(
        'ask_reformer',
        { question, maxChars: request.maxChars },
        request.signal
      );
      if (!outcome.ok) {
        console.warn('[plugins/reformer/ai] справка сервиса недоступна:', outcome.message);
        return null;
      }
      return { text: outcome.value.text };
    },

    async checkCode(code, request) {
      const outcome = await call<{ findings: CodeFinding[] }>(
        'check_code',
        { code },
        request.signal
      );
      if (!outcome.ok) {
        console.warn('[plugins/reformer/ai] проверка кода сервиса недоступна:', outcome.message);
        return null;
      }
      return { findings: outcome.value.findings };
    },
  };
}

/**
 * Поставщики, о неверной форме которых уже сказано, — чтобы консоль не повторяла это на каждый
 * вызов. Слабые ссылки: снятый поставщик не держится здесь после своего плагина.
 */
const warned = new WeakSet<object>();

/** Похож ли объект на справку: метод вопроса есть, метод проверки — функция либо отсутствует. */
function isReference(value: unknown): value is LibraryReferenceService {
  if (typeof value !== 'object' || value === null) return false;
  const { ask, checkCode } = value as { ask?: unknown; checkCode?: unknown };
  return typeof ask === 'function' && (checkCode === undefined || typeof checkCode === 'function');
}

/**
 * Справка, которая действует сейчас: поставщика, если он есть и годен, иначе сервиса.
 *
 * **Форма проверяется здесь, а не доверяется манифесту.** Поставщик держит свою копию контракта, и
 * в рантайме версии нет: копия старого или чужого образца нашлась бы по идентификатору и упала бы
 * посреди хода на вызове метода, которого у неё нет. Негодный поставщик заменяется справкой
 * сервиса с одним предупреждением в консоли — ход об этом не узнаёт.
 *
 * **Недостающая проверка кода — сервиса.** Барьер записи режима файлов держится на проверке кода,
 * и поставщик справки, не написавший её, не должен его снимать. Снять осознанно можно — методом,
 * который отвечает `null`.
 *
 * Методы поставщика зовутся с ним самим в роли `this`, а не вынутыми из объекта: реализация-класс
 * опирается на `this`.
 *
 * @param provided - Что лежит в слоте возможности; `unknown`, потому что форму здесь и проверяют.
 */
export function chooseReference(
  provided: unknown,
  fallback: Required<LibraryReferenceService>
): Required<LibraryReferenceService> {
  if (provided === undefined) return fallback;
  if (!isReference(provided)) {
    if (typeof provided === 'object' && provided !== null && !warned.has(provided)) {
      warned.add(provided);
      console.warn(
        '[plugins/reformer/ai] справка по библиотеке плагина-поставщика не подходит по форме ' +
          'контракта reformer.ai-schema.reference — действует справка сервиса',
        provided
      );
    }
    return fallback;
  }
  const { checkCode } = provided;
  return {
    ask: (question, request) => provided.ask(question, request),
    checkCode:
      checkCode === undefined
        ? fallback.checkCode
        : (code, request) => checkCode.call(provided, code, request),
  };
}
