/**
 * Подпуть `@reformer/core/render` — то, что нужно рендереру схемы и не зависит от слоя
 * представления. Рендереры на React, Vue и Angular рисуют одно и то же дерево узлов; правила, по
 * которым поле связывается с контролом, а узел собирает свои пропсы, у них общие и лежат здесь.
 *
 * - **Привязка поля:** диалект контрола (статика `reformerAdapter`), срез props, адресованных
 *   обёртке поля, и управляемая привязка значения. Привязка к React — `@reformer/core/react`: она
 *   отдаёт те же имена и добавляет неуправляемую привязку и хуки.
 * - **Пропсы узла:** порядок слияния (схема → нода формы → поведение), сигналы в пропсах,
 *   служебные ключи поля, вывод `testId`, колбэки `onComponentEvent`.
 * - **Массив и текст:** стабильные ключи строк, индексы строк формы, склейка частей текста.
 * - **Замечания:** какое показывать, когда место есть на одно.
 *
 * React этот вход не импортирует.
 *
 * @group Render
 * @module render
 * @mergeModuleWith <project>
 */

export {
  FIELD_WRAPPER_ONLY_PROPS,
  bindControlledFieldProps,
  getFieldAdapter,
  hasInlineLabel,
} from './render/field-adapter';
export type {
  FieldAdapter,
  FieldAdapterCarrier,
  FieldSeam,
  FieldValueSource,
} from './render/field-adapter';

export {
  fieldTestId,
  mergeNodeProps,
  needsControl,
  signalPropKeys,
  splitFieldProps,
  unwrapSignalProps,
} from './render/node-props';
export type { FieldOwnProps } from './render/node-props';

export { overrideWithEvents, withComponentEvents } from './render/events';
export type { ComponentEvents } from './render/events';

export { formIndexOf, stableKey } from './render/array-items';
export type { ArrayReader } from './render/array-items';

export { joinTextParts, nodesOnly } from './render/text';
export { primaryIssue } from './render/issues';
export { VOID_HTML_TAGS } from './render/html';
