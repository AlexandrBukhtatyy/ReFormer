/**
 * Плоская карта «имя экспорта → компонент» — то, по чему билдер резолвит записи каталога.
 *
 * Каноническое имя ReFormer ложится на компонент HexaUI через каталог (`exportName` записи):
 * `Separator` → их `Divider`, `Spinner` → `Loader`, `Progress` → `ProgressBar`, поле `Checkbox` →
 * `CheckboxWithLabel`. Namespace лишь обязан отдать символ под этим именем.
 *
 * ## Что сюда входит и что нет
 *
 * Пространство имён грузится в билдер целиком, поэтому в нём только то, что превью рисует вживую:
 * поля (`./fields`), палитра HexaUI (`./palette` — контейнеры, отображение, действия), плоские
 * статики палитры и инфраструктура кита. Нет тяжёлого (`./heavy`: CodeMirror, xterm, `FieldSet`) и
 * записей `limited` — оверлеев, навигации, таблиц и деревьев: превью рисует их подписанной
 * заглушкой, и компонент ему не нужен. Во входе пакета (`src/index.ts`) они есть — кодоген печатает
 * их импорт из пакета.
 *
 * Модули, которые сюда импортируются, берут значения HexaUI только с подпутей — почему, сказано в
 * `./palette`. Отсюда же: `./components` (там и главный вход HexaUI) сюда не импортируется.
 *
 * Под теми же именами те же символы экспортирует вход пакета: из namespace их берёт превью
 * билдера, из входа — сгенерированный модуль формы. Оба состава с каталогом сверяет
 * `src/builder-plugin.test.ts` (ключи — глазами компилятора, с учётом разворотов).
 *
 * @module reformer/kit-hexa-ui/namespace
 */

import type { KitNamespace } from '@reformer/builder-plugin-api';
import { ButtonGroup, SplitButton, StatusGroup, TagGroup } from './compound';
import { FieldFrame } from './field-frame';
import * as fields from './fields';
import { FormField } from './form-field';
import * as palette from './palette';
import { Box, KitProvider, Section } from './provider';
import { FormWizard } from './wizard';

/** Namespace кита HexaUI. */
export const HEXA_UI_NAMESPACE = {
  // Инфраструктура кита: обёртка и рамка поля, провайдер темы, визард по протоколу `3.0`.
  FormField,
  FieldFrame,
  KitProvider,
  FormWizard,

  // Поля — имена записей `@reformer/ui-kit` либо их `exportName`. Диалект контрола — статика
  // `reformerAdapter`.
  ...fields,

  // Контейнеры ReFormer, которых в HexaUI нет.
  Box,
  Section,

  // Компоненты HexaUI как есть: контейнеры, отображение, действия — и плоские статики к ним.
  ...palette,
  ButtonGroup,
  SplitButton,
  TagGroup,
  StatusGroup,
} satisfies KitNamespace;
