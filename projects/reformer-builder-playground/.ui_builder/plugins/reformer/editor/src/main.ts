/**
 * Точка входа плагина: оболочка ждёт объект плагина экспортом по умолчанию.
 *
 * @module plugins/reformer/editor/main
 */

import { DocumentModelPoint } from '@reformer/builder-plugin-api';
import { createSchemaEditorPlugin } from './plugin';

export default createSchemaEditorPlugin({ modelPoint: DocumentModelPoint });
