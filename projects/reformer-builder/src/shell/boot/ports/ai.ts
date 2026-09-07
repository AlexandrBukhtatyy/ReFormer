/**
 * Порт ассистента, собранный из платформы.
 *
 * Отличие от портов редакторов одно, и оно вынужденное: **два перевода вместо одного**.
 * Панель чата — компонент, ей нужен реактивный хук; мост же работает вне React (ход агента
 * идёт в промисе), и хук там вызвать нельзя. Поэтому рядом с `useTranslate` стоит обычная
 * функция. Смена локали посреди хода оставит на экране прежний язык у уже отправленных
 * сообщений — это цена того, что ход не является отрисовкой.
 *
 * @module shell/boot/ports/ai
 */

import type { ResourceId } from '@/shell/platform/primitives/resource';
import type { ServiceRegistry } from '@/shell/platform/primitives/service';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { useLocale } from '@/shell/platform/ui/chrome/usePanels';
import type { CatalogEntry } from '@/lib/catalog/types';
import { KitsServiceToken } from '@/plugins/kits';
import { AI_PLUGIN_ID } from '@/plugins/ai/contract';
import type { AiDocument, AiHost, Translate, WriteMark } from '@/plugins/ai';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface AiHostDeps {
  readonly project: ProjectHost;
  readonly i18n: RootI18nService;
  readonly services: ServiceRegistry;
}

/** Пустой каталог: одна замороженная ссылка вместо нового массива на каждый вызов. */
const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/** Реактивный перевод для панели (именованная функция — ради правил хуков). */
function makeUseTranslate(i18n: RootI18nService): () => Translate {
  const view = i18n.forPlugin(AI_PLUGIN_ID);
  function useTranslate(): Translate {
    useLocale(i18n);
    return (key, params) => view.t(key, params);
  }
  return useTranslate;
}

export function createAiHost(deps: AiHostDeps): AiHost {
  const { project, i18n, services } = deps;
  const view = i18n.forPlugin(AI_PLUGIN_ID);

  return {
    useTranslate: makeUseTranslate(i18n),
    translate: (key, params) => view.t(key, params),

    activeResource: () => project.get()?.documents.get().activeId ?? null,

    documentOf: (id: ResourceId): AiDocument | null =>
      project.get()?.documents.documentOf(id) ?? null,

    // Третий аргумент обязателен к пробросу, и это не формальность: без него пометка
    // происхождения теряется на границе порта, а журнал записывает ход ассистента как
    // правку человека. Компилятор такую потерю НЕ ловит — реализация с меньшим числом
    // параметров присваивается функции с бо́льшим, и тесты плагина остаются зелёными,
    // потому что проверяют плагин, а не композицию.
    writeText(id: ResourceId, text: string, mark?: WriteMark) {
      const session = project.get();
      // Отказ, а не тишина: ход, ушедший в никуда, выглядит как применённый.
      if (session === null) {
        return Promise.reject(new Error(`проект не открыт: писать некуда (${id})`));
      }
      return session.workspace.writeText(id, text, mark);
    },

    catalog: () => services.get(KitsServiceToken)?.catalog() ?? NO_CATALOG,

    // Корпус знаний читает `package.json` проекта, чтобы понять, какие версии пакетов у человека.
    // Источник подходит по форме: `Source.read` отдаёт `{ text }` и сверх того — ревизию
    // и медиатип, которые корпусу не нужны и которые он просто не смотрит.
    //
    // Проекта нет — знаний о версиях нет, и это не отказ: ассистент работает на вшитом корпусе,
    // просто без поправки на конкретный проект.
    projectFiles: () => {
      const source = project.get()?.source;
      return source === undefined ? undefined : { read: (path: string) => source.read(path) };
    },
  };
}
