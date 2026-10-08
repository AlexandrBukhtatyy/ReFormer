/**
 * Вход тяжёлой части встроенного билдера: соединяет состав приложения с оболочкой, встроенной
 * в чужое приложение, — как `main.tsx` соединяет его с оболочкой «своя вкладка».
 *
 * Отдельный модуль и отдельный чанк: приложение-хозяин тянет его динамическим импортом из
 * `./index` только когда человек включил режим билдера. До этого в его сборке нет ни оболочки,
 * ни состава, ни стилей билдера.
 *
 * Стили приходят строкой, а не подключением: в чужом документе они живут, только пока открыт
 * оверлей (`shell/embedded/document-presence`).
 *
 * @module embedded-runtime
 */

import { applicationFromRuntime } from './application/builder-application';
import type {
  EmbeddedRuntime,
  EmbeddedRuntimeRequest,
} from './shell/embedded/ReformerBuilderFrame';
import { startEmbeddedRuntime } from './shell/embedded/runtime';
import styles from './index.css?inline';

export function start(request: EmbeddedRuntimeRequest): EmbeddedRuntime {
  return startEmbeddedRuntime({
    // Состав по умолчанию: конфига уровня запуска у встроенного билдера нет — запускает его
    // не лаунчер, а приложение.
    application: applicationFromRuntime({}),
    styles,
    pluginsUrl: request.pluginsUrl,
    location: () => window.location,
  });
}
