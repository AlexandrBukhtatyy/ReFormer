# @reformer/builder-plugin-api

Контракт плагина ReFormer Builder: всё, что плагин видит от платформы, и ничего сверх. Плагин
компилируется против этого пакета, а в рантайме получает тот же объект от оболочки билдера.
Версия пакета описывает КОНТРАКТ и от версии билдера не зависит.

## Установка

```bash
npm install --save-dev @reformer/builder-plugin-api
```

Только `devDependencies`: в рантайме оболочка подставляет свой экземпляр контракта (спецификаторы
`@reformer/builder-plugin-api` и прежний `@builder/sdk`), а сборка плагина держит его внешним.
Второй экземпляр означал бы вклады в чужой пустой реестр — без ошибки, просто без панели.

## Быстрый старт

Плагин с одной командой — то же, что кладёт `reformer-plugin create` из
[`@reformer/builder-plugin-cli`](../reformer-builder-plugin-cli/README.md):

```ts
// src/main.ts
import { definePlugin } from '@reformer/builder-plugin-api';

export default definePlugin({
  id: 'acme-forms',
  activate(ctx) {
    // Всё, что положено в subscriptions, снимается при выключении плагина.
    ctx.subscriptions.push(
      ctx.commands.register({
        id: 'acme-forms.hello',
        titleKey: 'command.hello', // ключ словаря плагина, а не текст
        run: () => true,
      })
    );
  },
});
```

```json
{
  "id": "acme-forms",
  "name": "Acme Forms",
  "version": "0.1.0",
  "apiVersion": "^1",
  "main": "src/main.ts",
  "contributes": { "messages": { "ru": "locales/ru.json", "en": "locales/en.json" } }
}
```

`activate(ctx)` получает `PluginContext`: `services`, `capabilities`, `extensions` (точки
расширения), `commands`, `events`, `i18n` (словарь плагина), `storage`, `secrets`,
`subscriptions`.

## Версии и права

- **`apiVersion`** (`"^1"`) — какие имена контракта нужны плагину; оболочка сверяет диапазон со
  своим `BUILDER_API_VERSION` до загрузки кода. Минор растёт на добавление имени, мажор — на
  удаление или смену смысла.
- **`compatibility.builder`** (`{ "builder": ">=2.1" }`) — вторая ось: какая версия самого
  приложения нужна плагину. Несовпадение — отказ загрузки с причиной `builder-version`; CLI автора
  своей версии билдера не знает и проверяет только форму диапазона.
- **`permissions`** — ключ к службе, которую оболочка отдаёт не всем. Без подтверждённого права
  `ctx.services.get` отвечает `undefined`. Подтверждает человек при включении плагина.

| Право                 | Что открывает                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `workspace.save`      | сохранение в источник проекта (`WorkspaceSaveServiceToken`)                                            |
| `workspace.resources` | менять записи проекта: создать, переименовать, перенести, удалить, скопировать, открыть другой каталог |
| `plugins.manage`      | распоряжаться остальными плагинами: включать, выключать, перезагружать, ставить из npm                 |

## Входы пакета

| Импорт                                  | Что внутри                                                                                                                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@reformer/builder-plugin-api`          | контракт плагина: `definePlugin`, `defineService`, `defineCapability`, точки расширения, токены служб, `useTranslate`, контракты редактора, превью, китов, ассистента, генерации кода и шаблонов                                                            |
| `@reformer/builder-plugin-api/tooling`  | то, что инструмент автора обязан делать буквально как оболочка: `parsePluginManifest`, `parsePluginSourceManifest`, `PLUGIN_RUNTIME_MODULES`, `PLUGIN_BUNDLED_PACKAGES`, `normalizeModulePath`, `pluginFromExports`, `loadCatalogValidator`; типы манифеста |
| `@reformer/builder-plugin-api/internal` | платформенные примитивы для самой оболочки; обещаний совместимости нет, плагину не нужен                                                                                                                                                                    |

Что покрывает главный вход, по областям:

- **редактор** (`EditorPoint`): фокус в `TextEditorFocusToken`, `documents.flush` после снятия
  фокуса, одна стабильная ссылка `Body`, своя отмена модельного документа;
- **словарь** (`ctx.i18n`): ключи в пространстве имён плагина, `useTranslate` в React, коды
  диагностик с владельцем (`pluginDiagnosticCode`);
- **журнал** (`LogServiceToken`), **превью** (`PreviewSurfacePoint`, `PreviewLiveCapability`,
  `AppPreviewCapability`), **место модуля формы** (`FormModulePoint`);
- **модель документа и рабочая область** — возможности `DocumentModelsCapability`,
  `WorkspaceFilesCapability`, `WorkspaceSourceCapability`, `WorkspaceTreeCapability`;
- **киты** — каталог `component-catalog.json` (`CatalogJson`, `KitSourcePoint`, `KitsCapability`);
- **ассистент** — `AssistantToolPoint`, `AssistantResourcePoint`, стек форм
  `FormAssistantStackPoint`;
- **генерация кода и шаблоны** — `CodegenStackPoint`, `CodegenTargetPoint`, `TemplateStorePoint`,
  `TemplateStackPoint`, `ModuleGeneratorCapability`, `FormCreatorCapability`.

## Ссылки

- Документация: [билдер](https://alexandrbukhtatyy.github.io/ReFormer/docs/builder/overview),
  [плагины: понятия](https://alexandrbukhtatyy.github.io/ReFormer/docs/builder/plugins/concepts),
  [манифест и API плагина](https://alexandrbukhtatyy.github.io/ReFormer/docs/builder/plugins/manifest-and-api)
- Создать, проверить и собрать плагин: [`@reformer/builder-plugin-cli`](../reformer-builder-plugin-cli/README.md)
- Общие кирпичи стеков (печать кода, маркер, реестр инструментов): [`@reformer/builder-toolkit`](../reformer-builder-toolkit/README.md)

## Лицензия

MIT
