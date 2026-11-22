/**
 * Порт плагина журнала из служб SDK.
 *
 * - вкладки и документы — `reformer.workspace` (служба документов);
 * - перевод кодов находок, подписей исправлений и сообщений записей — словарь оболочки
 *   (`reformer.host.messages`);
 * - отказ перехода к ресурсу — записью в журнал (`reformer.log`), а не в консоль: человек
 *   щёлкнул строку, и «ничего не произошло» без следа было бы хуже отказа.
 *
 * Службы спрашиваются на КАЖДЫЙ вызов: проект закрывают и открывают заново, а порт живёт
 * с плагином.
 *
 * @module plugins/base/journal/host-from-context
 */

import { useMemo } from 'react';
import {
  DocumentsServiceToken,
  errorDetail,
  HostMessagesCapability,
  LogServiceToken,
  pluginMessageKey,
  resourceNameOf,
  useTranslate,
  type Disposable,
  type HostMessagesService,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { timeFormatter } from './events';
import type { JournalHost, ResourceName, Translate } from './host';

const NOOP: Disposable = Object.freeze({ dispose: () => {} });

/** Словаря оболочки нет — показывают сам ключ: читаемо для разработчика, и ничего не падает. */
const NO_MESSAGES: HostMessagesService = Object.freeze({
  locale: '',
  t: (key: string) => key,
  diagnosticMessage: (code: string) => code,
  onDidChangeLocale: () => NOOP,
});

export function journalHostFromContext(
  ctx: Pick<PluginContext, 'id' | 'services' | 'i18n'>
): JournalHost {
  const documents = () => ctx.services.get(DocumentsServiceToken);
  const messages = () => ctx.services.get(HostMessagesCapability) ?? NO_MESSAGES;

  /** Имя без разбора исключений: адрес, который платформа не разобрала, остаётся собой. */
  const parsedName = (id: ResourceId): ResourceName | null => {
    try {
      return resourceNameOf(id);
    } catch {
      return null;
    }
  };

  // Именованные функции: правила хуков опознают хук по имени объявления.
  function useJournalTranslate(): Translate {
    return useTranslate(ctx.i18n);
  }

  // Коды находок переводит словарь ВЛАДЕЛЬЦА кода: одна ошибка обязана звучать одинаково
  // в журнале, в подчёркивании редактора кода и на узле канваса.
  function useDiagnosticMessage(): Translate {
    const source = messages();
    // Подписка на смену локали: значение нужно не переводу, а перерисовке.
    useTranslate(source);
    return (code, params) => source.diagnosticMessage(code, params);
  }

  function useHostMessage(): Translate {
    return useTranslate(messages());
  }

  function useFormatTime(): (time: number) => string {
    // Подписка на смену локали — та же, что у перевода: формат времени меняется вместе с языком.
    useTranslate(ctx.i18n);
    const locale = ctx.i18n.locale;
    return useMemo(() => timeFormatter(locale), [locale]);
  }

  return {
    useTranslate: useJournalTranslate,
    useDiagnosticMessage,
    useHostMessage,
    useFormatTime,

    // Открываем НЕ в режиме предпросмотра: человек пришёл чинить находку, а не посмотреть,
    // и вкладка обязана остаться после следующего щелчка.
    openResource(id: ResourceId) {
      void documents()
        ?.open(id, { preview: false })
        .catch((error: unknown) => {
          console.error(`[journal] переход к «${id}» не удался`, error);
          ctx.services.get(LogServiceToken)?.append({
            level: 'error',
            source: ctx.id,
            messageKey: pluginMessageKey(ctx.id, 'open.failed'),
            params: { name: parsedName(id)?.name ?? id },
            detail: errorDetail(error),
            resource: id,
          });
        });
    },

    // Открытый документ называет себя сам; закрытый (сайдкар с ошибкой сборки) — разбором
    // адреса платформой: подписывать его сырым адресом было бы нечитаемо.
    nameOf(id: ResourceId) {
      const ref = documents()?.documentOf(id)?.ref;
      if (ref !== undefined) return { name: ref.name, path: ref.path };
      return parsedName(id);
    },
  };
}
