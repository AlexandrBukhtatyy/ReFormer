/**
 * Точка входа плагина: оболочка ждёт объект плагина экспортом по умолчанию.
 *
 * @module plugins/reformer/codegen/main
 */

import { createCodegenStackPlugin } from './plugin';

export default createCodegenStackPlugin();
