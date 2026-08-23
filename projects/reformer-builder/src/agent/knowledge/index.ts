/**
 * Корпус знаний о ReFormer — тот же, что у MCP-сервера, но собранный для браузера.
 *
 * Источников два, и они не равнозначны:
 *
 *  1. **`node_modules` открытого проекта** — версии, которые реально стоят у пользователя.
 *     Предпочитается всегда, когда доступен.
 *  2. **Артефакт сборки билдера** — версии, с которыми билдер собран. Работает без открытой
 *     папки, в том числе на хостед-сборке.
 *
 * Почему первый важнее. Билдер публикуется отдельно от библиотек и живёт дольше любой их
 * версии; справка про API, которого в проекте нет, выглядит достоверно и потому хуже
 * отсутствующей. MCP-сервер решает это, читая индекс у установленного пакета
 * (`core/index/merge.ts`); File System Access даёт браузеру ту же возможность.
 *
 * Артефакт (`generated/knowledge-index.json` и `knowledge-docs.json`) генерируется при сборке
 * из `llms.txt` и `llms-index.json` установленных пакетов, и в git не коммитится: его версия
 * обязана совпадать со сборкой, а не с моментом, когда его последний раз обновили руками.
 *
 * Импорт ОБЯЗАТЕЛЬНО динамический — по той же причине, по которой динамически грузятся киты
 * (`kits/registry.ts`): статический положил бы 2.8 МБ JSON в основной чанк, и за них платил бы
 * размером первого экрана каждый, кто ассистентом не пользуется.
 *
 * @module reformer-builder/agent/knowledge
 */

import { createBrowserKnowledge } from '@reformer/mcp/browser';
import type { Knowledge } from '@reformer/mcp/dist/core/knowledge.js';
import { projectStore } from '../../store/project-store';
import { readProjectBundles } from './project-source';

/** Откуда пришли знания — попадает в ответ инструмента, чтобы источник был виден. */
export interface KnowledgeSource {
  knowledge: Knowledge;
  origin: 'project' | 'bundle';
  /** Пакет → версия. Пусто для вшитого корпуса: там версия одна на всю сборку. */
  versions: Record<string, string>;
}

/** Кэш вшитого корпуса: он один на всё время жизни вкладки. */
let bundled: Promise<KnowledgeSource | null> | null = null;

/** Кэш проектного корпуса, привязанный к КОНКРЕТНОЙ папке: сменили папку — читаем заново. */
let projectFor: FileSystemDirectoryHandle | null = null;
let projectCache: Promise<KnowledgeSource | null> | null = null;

/**
 * Знание для этой вкладки. `null` — ни проектного корпуса, ни артефакта: ассистент обязан
 * работать и так, просто без справки.
 */
export async function loadKnowledge(): Promise<KnowledgeSource | null> {
  const dir = projectStore.getState().dirHandle;
  if (dir) {
    const fromProject = await projectKnowledge(dir);
    if (fromProject) return fromProject;
  }
  return (bundled ??= bundledKnowledge());
}

async function projectKnowledge(dir: FileSystemDirectoryHandle): Promise<KnowledgeSource | null> {
  if (projectFor !== dir) {
    projectFor = dir;
    projectCache = build(dir);
  }
  return projectCache;

  async function build(root: FileSystemDirectoryHandle): Promise<KnowledgeSource | null> {
    try {
      const bundles = await readProjectBundles(root);
      if (!bundles) return null;
      const { knowledge } = createBrowserKnowledge({ index: bundles.index, docs: bundles.docs });
      return { knowledge, origin: 'project', versions: bundles.versions };
    } catch (error) {
      // Отказ прав или закрытая папка — не повод падать: ниже есть вшитый корпус. Но и молчать
      // нельзя: разница между «версии пользователя» и «версии сборки» видна только здесь.
      console.warn('[reformer-builder] не удалось прочитать @reformer/* из проекта', error);
      return null;
    }
  }
}

async function bundledKnowledge(): Promise<KnowledgeSource | null> {
  try {
    const [index, docs] = await Promise.all([
      import('./generated/knowledge-index.json'),
      import('./generated/knowledge-docs.json'),
    ]);
    const { knowledge } = createBrowserKnowledge({
      index: (index.default ?? index) as never,
      docs: (docs.default ?? docs) as never,
    });
    return { knowledge, origin: 'bundle', versions: {} };
  } catch (error) {
    // Отсутствие артефакта — состояние сборки, а не ошибка выполнения. Молчать нельзя: без
    // этой строки «ассистент не отвечает про библиотеку» выглядело бы как баг модели.
    console.warn(
      '[reformer-builder] корпус знаний не загружен — справка по библиотеке недоступна. ' +
        'Соберите его: npm run generate:knowledge',
      error
    );
    return null;
  }
}

/** Только для тестов — забыть загруженное. */
export function __resetKnowledge(): void {
  bundled = null;
  projectFor = null;
  projectCache = null;
}
