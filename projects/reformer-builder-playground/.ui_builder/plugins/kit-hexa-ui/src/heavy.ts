/**
 * Тяжёлые компоненты HexaUI — только во входе пакета для приложения, не в пространстве имён
 * билдера.
 *
 * За каждым — свой движок в сотни килобайт: CodeMirror (`CodeViewer`), разбор и отрисовка диффов
 * (`CodeCompare`), xterm (`Terminal`). `FieldSet` (с частью `KeyValueMapper`) — набор полей,
 * который сам подбирает контрол по типу значения и потому статически тянет и CodeMirror, и
 * календарь с локалями date-fns. `LicenseCard` форматирует даты генератором antd на date-fns — и
 * тянет все его локали, около двух мегабайт. Приложение, которое их не импортирует, их и не
 * получит (HexaUI помечен как пакет без побочных эффектов). Билдер их не рисует: в каталоге это
 * записи `limited`.
 *
 * Редакторы-поля (`RichTextEditor`, `CodeEditor`) и календари (`DatePicker`, `DatePickerRange`)
 * сюда не относятся: обёртка поля лёгкая, а движок она грузит лениво (`./fields`).
 *
 * @module reformer/kit-hexa-ui/heavy
 */

import { FieldSet } from '@kaspersky/hexa-ui/field-set';

export { CodeCompare } from '@kaspersky/hexa-ui/code-compare';
export { CodeViewer } from '@kaspersky/hexa-ui/code-viewer';
export { FieldSet } from '@kaspersky/hexa-ui/field-set';
export { LicenseCard } from '@kaspersky/hexa-ui/license-card';
export { Terminal } from '@kaspersky/hexa-ui/terminal';

/** Ряды «ключ — значение» набора полей: `FieldSet.KeyValueMapper`. */
export const KeyValueMapper = FieldSet.KeyValueMapper;
