/**
 * Словарь оболочки на чтение — служба `reformer.host.messages`, собранная из платформы.
 *
 * Обёртка, а не сам корень локализации: `contribute` корня плагину не принадлежит.
 *
 * Перевод кода находки живёт ЗДЕСЬ, а не у каждого, кто находку показывает: одна и та же
 * ошибка обязана выглядеть одинаково в подчёркивании редактора кода, на узле канваса, значком
 * в дереве и строкой в панели проблем. Раньше приставку `errors.` ставили три порта, собранных
 * композицией; внешний редактор перевести код находки с владельцем не мог вовсе.
 *
 * @module shell/boot/ports/host-messages
 */

import {
  splitDiagnosticCode,
  type HostMessagesService,
} from '@reformer/builder-plugin-api/internal';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';

export function createHostMessagesService(i18n: RootI18nService): HostMessagesService {
  return {
    get locale() {
      return i18n.locale;
    },
    t: (key, params) => i18n.t(key, params),
    onDidChangeLocale: (cb) => i18n.onDidChangeLocale(cb),

    diagnosticMessage(code, params) {
      // Код с владельцем (`<plugin-id>:<code>`) переводит словарь владельца: стек, пришедший
      // плагином, в словарь оболочки не пишет, и оболочка его ошибок не знает.
      const owned = splitDiagnosticCode(code);
      return owned.pluginId === null
        ? i18n.t(`errors.${owned.code}`, params)
        : i18n.forPlugin(owned.pluginId).t(`errors.${owned.code}`, params);
    },
  };
}
