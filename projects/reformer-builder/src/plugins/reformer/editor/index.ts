/**
 * Публичная поверхность плагина «редактор схемы формы».
 *
 * Наружу плагин отдаёт **только этот модуль** (project-structure.md, «Устройство плагина»):
 * всё остальное — его внутренности, и правило проверяется запретом импорта из каталога
 * чужого плагина глубже его корня.
 *
 * Отсюда следует состав. Композиции нужно ровно четыре вещи: собрать плагин, объявить порт,
 * который она обязана предоставить, зарегистрировать словарь (сервиса локализации
 * в `PluginContext` нет) и знать идентификатор провайдера — он же вид ресурса в контексте
 * применимости. Ни канвас, ни операции, ни модель инспектора сюда не входят: их вызывает
 * только сам плагин.
 *
 * @module plugins/reformer/editor/index
 */

import { createSchemaEditorPlugin, type SchemaEditorPluginOptions } from './plugin';

export { createSchemaEditorPlugin, SCHEMA_EDITOR_ID, SCHEMA_EDITOR_PLUGIN_ID } from './plugin';
export type { SchemaEditorPluginOptions } from './plugin';
export { SCHEMA_MODEL_PROVIDER_ID } from './model/provider';
export { SCHEMA_EDITOR_MESSAGES } from './messages';
export type {
  ExtensionPointRef,
  MessageSink,
  SchemaApplyOutcome,
  SchemaEditorHost,
  SchemaModelDocument,
  SchemaModelHandle,
  SchemaModelProviderSpec,
  Translate,
} from './host';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins` и зовёт с набором портов оболочки.
 * Плагину нужна точка расширения моделей документов: её он объявил структурно, настоящая
 * приходит параметром.
 */
export default function builtin(ports: {
  readonly modelPoint: SchemaEditorPluginOptions['modelPoint'];
}) {
  return createSchemaEditorPlugin({ modelPoint: ports.modelPoint });
}
