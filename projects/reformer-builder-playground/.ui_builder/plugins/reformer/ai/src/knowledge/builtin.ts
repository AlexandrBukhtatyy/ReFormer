/**
 * Встроенная справка по требованию и выбор между ней и справкой плагина-поставщика.
 *
 * Модуль ЛЁГКИЙ и лежит в главном чанке стека: MCP он не импортирует. Встроенная реализация
 * (`./mcp-reference`) грузится динамическим импортом на первый вопрос к справке или первую
 * проверку кода — до того она не стоит ничего тому, кто ассистентом не пользуется.
 *
 * @module plugins/reformer/ai/knowledge/builtin
 */

import type { LibraryReferenceService } from '../reference';
import type { PackageFiles } from './project-source';

/** Модуль встроенной справки — в том объёме, в каком его зовёт загрузка. */
interface McpReferenceModule {
  createMcpReference(files?: () => PackageFiles | undefined): Required<LibraryReferenceService>;
}

/**
 * Встроенная справка, которая грузит себя на первое обращение.
 *
 * Промис запоминается ЦЕЛИКОМ, а не его результат: параллельные вопросы (справка и проверка кода
 * в одном ходе) обязаны дождаться одной загрузки, а не завести вторую. Неудача НЕ запоминается:
 * ячейка освобождается, и следующий вызов пробует снова — одна сорвавшаяся загрузка не должна
 * выключать справку до перезагрузки страницы. Тот же порядок у загрузки проверки по мета-схеме
 * (`createValidateFormLoader` в `../plugin`).
 *
 * @param files - Чтение файлов открытого проекта; `undefined` — останется вшитый корпус.
 * @param load - Чем грузить; подменяется в тестах, чтобы не тянуть настоящий модуль.
 */
export function createBuiltinReference(
  files?: () => PackageFiles | undefined,
  load: () => Promise<McpReferenceModule> = () => import('./mcp-reference')
): Required<LibraryReferenceService> {
  let started: Promise<Required<LibraryReferenceService>> | undefined;
  const reference = (): Promise<Required<LibraryReferenceService>> => {
    started ??= load().then(
      (module) => module.createMcpReference(files),
      (error: unknown) => {
        started = undefined;
        throw error;
      }
    );
    return started;
  };
  return {
    ask: async (question, request) => (await reference()).ask(question, request),
    checkCode: async (code, request) => (await reference()).checkCode(code, request),
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
 * Справка, которая действует сейчас: поставщика, если он есть и годен, иначе встроенная.
 *
 * **Форма проверяется здесь, а не доверяется манифесту.** Поставщик держит свою копию контракта, и
 * в рантайме версии нет: копия старого или чужого образца нашлась бы по идентификатору и упала бы
 * посреди хода на вызове метода, которого у неё нет. Негодный поставщик заменяется встроенной
 * справкой с одним предупреждением в консоли — ход об этом не узнаёт.
 *
 * **Недостающая проверка кода — встроенная.** Барьер записи режима файлов держится на проверке
 * кода, и поставщик справки, не написавший её, не должен его снимать. Снять осознанно можно —
 * методом, который отвечает `null`.
 *
 * Методы поставщика зовутся с ним самим в роли `this`, а не вынутыми из объекта: реализация-класс
 * опирается на `this`.
 *
 * @param provided - Что лежит в слоте возможности; `unknown`, потому что форму здесь и проверяют.
 */
export function chooseReference(
  provided: unknown,
  builtin: Required<LibraryReferenceService>
): Required<LibraryReferenceService> {
  if (provided === undefined) return builtin;
  if (!isReference(provided)) {
    if (typeof provided === 'object' && provided !== null && !warned.has(provided)) {
      warned.add(provided);
      console.warn(
        '[plugins/reformer/ai] справка по библиотеке плагина-поставщика не подходит по форме ' +
          'контракта reformer.ai-schema.reference — действует встроенная',
        provided
      );
    }
    return builtin;
  }
  const { checkCode } = provided;
  return {
    ask: (question, request) => provided.ask(question, request),
    checkCode:
      checkCode === undefined
        ? builtin.checkCode
        : (code, request) => checkCode.call(provided, code, request),
  };
}
