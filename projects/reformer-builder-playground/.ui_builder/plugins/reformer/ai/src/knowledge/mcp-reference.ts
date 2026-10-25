/**
 * Встроенная справка по библиотеке — на `@reformer/mcp`: тот же каскад и та же проверка кода, что
 * у MCP-сервера, над корпусом из `./index`.
 *
 * Единственный модуль стека, который зовёт MCP: справку и проверку кода остальной стек знает только
 * контрактом (`../reference`). Модуль грузится по требованию (`./builtin`) — в главный чанк
 * плагина не едут ни каскад `askReformer` с поиском и рецептами, ни разбор корпуса.
 *
 * Каскад (`choose_api` → рецепт → полнотекст) исполняется внутри `askReformer` — кодом, а не
 * моделью. Промежуточные промахи в контекст не попадают: наружу уходит только собранный ответ.
 *
 * @module plugins/reformer/ai/knowledge/mcp-reference
 */

import { askReformer } from '@reformer/mcp/dist/core/facade.js';
import type { CodeFinding, LibraryReferenceService } from '../reference';
import { createKnowledgeLoader, type KnowledgeLoader, type PackageFiles } from './index';

/** Диагностика проверки кода MCP — в том объёме, в каком её отдаёт контракт. */
interface McpDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly line?: number;
  readonly suggestion?: string;
}

/**
 * Собрать встроенную справку.
 *
 * @param files - Чтение файлов открытого проекта; `undefined` — проекта нет, останется вшитый
 *   корпус. Функция: проект переоткрывают, и корпус обязан быть того проекта, что открыт СЕЙЧАС.
 * @param loadKnowledge - Откуда брать корпус; подменяется в тестах.
 */
export function createMcpReference(
  files?: () => PackageFiles | undefined,
  loadKnowledge: KnowledgeLoader = createKnowledgeLoader(files)
): Required<LibraryReferenceService> {
  return {
    async ask(question, request) {
      const source = await loadKnowledge();
      // Корпус не собран — это состояние сборки, а не ошибка: стек скажет модели, что справки нет.
      if (!source) return null;

      // Источник называется в ответе, когда знания взяты из проекта: агент должен понимать, что
      // это версии ПОЛЬЗОВАТЕЛЯ, а не те, с которыми собран билдер. Для вшитого корпуса строки
      // нет — она стоила бы символов в каждом ответе, не добавляя выбора.
      const suffix = source.origin === 'project' ? sourceLine(source.versions) : '';

      // Приписка вычитается ДО нарезки, а не дописывается после. Иначе ответ у верхней границы
      // бюджета вместе с ней перевалит за неё, и `clamp` в реестре срежет хвост — то есть саму
      // приписку. Замер: 5 ответов из 6 упирались в границу, и источник терялся ровно там, где
      // он важнее всего.
      const answer = await askReformer(source.knowledge, question, {
        maxChars: request.maxChars - suffix.length,
      });
      return { text: suffix ? `${answer.text}${suffix}` : answer.text };
    },

    async checkCode(code) {
      const source = await loadKnowledge();
      if (!source) return null;
      // Динамический импорт и здесь: таблицы проверки кода не нужны тому, кто только спрашивает,
      // и не должны ехать вместе с каскадом справки.
      const { validateCode } = await import('@reformer/mcp/dist/core/validate/code.js');
      const { diagnostics } = await validateCode(source.knowledge, code);
      return { findings: diagnostics.map(findingOf) };
    },
  };
}

/** Находка контракта из диагностики MCP: только поля контракта, без подсказок про инструменты MCP. */
function findingOf(diagnostic: McpDiagnostic): CodeFinding {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...(diagnostic.line !== undefined ? { line: diagnostic.line } : {}),
    ...(diagnostic.suggestion !== undefined ? { suggestion: diagnostic.suggestion } : {}),
  };
}

/** Строка про источник знаний — считается заранее, потому что её длина входит в бюджет ответа. */
function sourceLine(versions: Record<string, string>): string {
  const list = Object.entries(versions)
    .map(([packageName, version]) => `${packageName.replace('@reformer/', '')}@${version}`)
    .join(', ');
  return `\n\n_Источник: node_modules проекта${list ? ` (${list})` : ''}._`;
}
