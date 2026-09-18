/**
 * Превью-хост: КАК показывать документ — одно на все стеки.
 *
 * **Что здесь.** Правило выбора поверхности, состояния документов (введённые значения,
 * опубликованная форма, находки сборки), канал выделения, свод диагностик и живой вид —
 * возможность `reformer.preview.live`, которой редакторы показывают документ. Точка поверхностей
 * объявлена в `@reformer/builder-plugin-api`, и заполняют её ДРУГИЕ плагины.
 *
 * **Чего здесь нет.** Ни одной поверхности. Чем рисовать схему — знание стека: поверхности
 * формы ReFormer вносит `plugins/preview-runtime`, другой стек вносит свои. Пока поверхности жили
 * здесь, второй стек получал превью только вместе с чужим рендерером.
 *
 * **Своего интерфейса у плагина нет.** Форма — ПРЕДСТАВЛЕНИЕ редактора (живой вид), а не полоса
 * внизу экрана: две одинаковые картинки на одном экране стоили двух сборок формы.
 *
 * @module plugins/preview/plugin
 */

import manifest from './manifest.json';
import {
  definePlugin,
  DiagnosticsServiceToken,
  DocumentModelsCapability,
  DocumentsServiceToken,
  PreviewLiveCapability,
  SelectionServiceToken,
  WorkspaceFilesServiceToken,
  type Plugin,
} from '@reformer/builder-plugin-api';
import { hostFromServices, type PreviewHostPort } from './host';
import { createLiveService } from './live/live-service';
import { PREVIEW_MESSAGES } from './messages';
import { attachPreviewLifecycle } from './state/lifecycle';
import { createPreviewSessions, type PreviewSessions } from './state/sessions';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const PREVIEW_PLUGIN_ID = manifest.id;

export interface PreviewPluginOptions {
  /**
   * Адрес документа и права источника. Обычно плагин собирает их сам из возможностей оболочки
   * (`./host`); параметр — ради тестов, которым нужен документ без рабочей области.
   */
  readonly host?: PreviewHostPort;
  /**
   * Реестр состояний. Обычно плагин заводит его сам; параметр — ради тестов, которым нужен
   * доступ к нему снаружи активации.
   */
  readonly sessions?: PreviewSessions;
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует: реестр состояний создаётся пустым, состояние документа
 * рождается при первом обращении.
 */
export function createPreviewPlugin(options: PreviewPluginOptions = {}): Plugin {
  const sessions = options.sessions ?? createPreviewSessions();

  return definePlugin({
    id: PREVIEW_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(PREVIEW_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      // Порт — из возможностей оболочки, и спрашиваются они на каждый вызов, а не здесь: без
      // рабочей области документов нет, и ответ «нечего показывать» честен.
      const host =
        options.host ??
        hostFromServices({
          documents: () => ctx.services.get(DocumentsServiceToken),
          files: () => ctx.services.get(WorkspaceFilesServiceToken),
          models: () => ctx.services.get(DocumentModelsCapability),
        });

      // Живой вид — наружу возможностью: его читают редакторы стеков, а плагины друг друга
      // не импортируют. Регистрация в `subscriptions`, потому что слот обязан освободиться
      // вместе с плагином: выключенное превью, оставившее занятый слот, не дало бы поднять
      // себя заново.
      ctx.subscriptions.push(
        ctx.services.register(
          PreviewLiveCapability,
          createLiveService({
            host,
            sessions,
            extensions: ctx.extensions,
            t: (key, params) => ctx.i18n.t(key, params),
          })
        )
      );

      // Состояние живёт, пока открыт хоть один файл каталога формы (см. `./state/lifecycle`).
      // `get`, а не `require`: без рабочей области правило просто не действует — забывать
      // нечего, потому что и открывать нечего. Так собирается и тест плагина, где реестра
      // служб нет вовсе.
      const documents = ctx.services.get(DocumentsServiceToken);
      const files = ctx.services.get(WorkspaceFilesServiceToken);
      if (documents !== undefined && files !== undefined) {
        ctx.subscriptions.push(attachPreviewLifecycle(documents, files, sessions));
      }

      // Клик по форме уходит в общий канал выделения. `get`, а не `require`: отсутствие
      // службы — штатная деградация, а не отказ.
      const selection = ctx.services.get(SelectionServiceToken);
      if (selection !== undefined) ctx.subscriptions.push(sessions.connectSelection(selection));

      // Находки сборки уходят в общий свод диагностик — под адресом файла, где чинить. Без
      // службы находки остаются в состоянии превью, и живой вид показывает их, как и раньше.
      const diagnostics = ctx.services.get(DiagnosticsServiceToken);
      if (diagnostics !== undefined) {
        ctx.subscriptions.push(sessions.connectDiagnostics(diagnostics));
        // Правка файла снимает его находки сборки до следующей сборки: они про текст, которого
        // уже нет. Порт вправе канала не дать — тогда находки живут до пересборки.
        const changes = host.onDidChangeFiles?.((changed) => {
          sessions.invalidate(changed);
        });
        if (changes !== undefined) ctx.subscriptions.push(changes);
      }
    },
    deactivate() {
      // Состояния не выражаются подпиской: они переживают перерисовку и переключение вкладки,
      // и снять их может только тот, кто их держит.
      sessions.dispose();
    },
  });
}
