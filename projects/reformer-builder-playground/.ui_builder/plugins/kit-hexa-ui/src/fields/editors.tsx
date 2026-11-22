/**
 * Редакторы: `RichTextEditor` (HexaUI `RichTextEditor` на slate) и `CodeEditor` (HexaUI
 * `CodeViewer` на CodeMirror).
 *
 * ## Ленивая загрузка
 *
 * Движки редакторов — сотни килобайт (slate, CodeMirror с языками). Поле-обёртка лёгкое и живёт
 * во входе пакета и в пространстве имён кита наравне с остальными, а сам редактор грузится
 * `import()` с подпути HexaUI при первой отрисовке поля. Сборка плагина и бандлер приложения
 * выносят его в отдельный файл.
 *
 * ## Неуправляемые компоненты
 *
 * Оба редактора читают начальное значение один раз. Значение, пришедшее СНАРУЖИ (сброс формы,
 * загрузка), показывается пересозданием — {@link useRemountKey}; своя правка редактор не трогает.
 *
 * Значения модели: документ — массив узлов slate (`unknown[] | null`, пустой документ — `null`),
 * код — строка либо `null`.
 *
 * @module reformer/kit-hexa-ui/fields/editors
 */

import {
  lazy,
  Suspense,
  type ComponentProps,
  type FocusEventHandler,
  type ReactElement,
} from 'react';
import type {
  CodeViewer as HexaCodeViewer,
  Descendant,
  Plugins,
  RichTextEditor as HexaRichTextEditor,
} from '@kaspersky/hexa-ui';
// Значения HexaUI — с подпутей: модуль входит в пространство имён билдера (см. `../palette`).
import { Loader } from '@kaspersky/hexa-ui/loader';
import { documentAdapter, textAdapter } from './adapters';
import { BlurScope, useRemountKey } from './control';
import { isEmptyDocument, sameDocument } from './convert';

// ---------------------------------------------------------------------------------------------
// Текст с разметкой
// ---------------------------------------------------------------------------------------------

/** Пропсы HexaUI `RichTextEditor` — их тип HexaUI отдельно не экспортирует. */
type HexaRichTextEditorProps = ComponentProps<typeof HexaRichTextEditor>;

/** Пропсы {@link RichTextEditor}: пропсы HexaUI без начального значения — его даёт значение поля. */
export type RichTextEditorProps = Omit<
  HexaRichTextEditorProps,
  'initialValue' | 'onChange' | 'plugins' | 'onBlur'
> & {
  /** Документ — узлы slate. */
  value?: unknown[] | null;
  onChange?: (value: unknown[] | null) => void;
  onBlur?: () => void;
  /** Плагины панели инструментов. По умолчанию — все плагины HexaUI. */
  plugins?: Plugins;
};

/** Движок редактора — с подпути HexaUI, лениво. Плагины по умолчанию — из того же модуля. */
const RichTextEngine = lazy(async () => {
  const module = await import('@kaspersky/hexa-ui/rich-text-editor');
  function Engine({
    plugins,
    ...props
  }: Omit<HexaRichTextEditorProps, 'plugins'> & { plugins?: Plugins }) {
    return <module.RichTextEditor {...props} plugins={plugins ?? module.allPlugins} />;
  }
  return { default: Engine };
});

/** Текст с разметкой: HexaUI `RichTextEditor`, загружается при первой отрисовке. */
export function RichTextEditor({
  value,
  onChange,
  autoFocus = false,
  ...rest
}: RichTextEditorProps) {
  const [key, emitted] = useRemountKey<unknown>(value, sameDocument);
  return (
    <Suspense fallback={<Loader />}>
      <RichTextEngine
        key={key}
        {...rest}
        autoFocus={autoFocus}
        initialValue={Array.isArray(value) ? (value as Descendant[]) : undefined}
        onChange={(document) => {
          const next = isEmptyDocument(document) ? null : document;
          emitted(next);
          onChange?.(next);
        }}
      />
    </Suspense>
  );
}
RichTextEditor.reformerAdapter = documentAdapter;

// ---------------------------------------------------------------------------------------------
// Код
// ---------------------------------------------------------------------------------------------

/** Языки, которые HexaUI `CodeViewer` знает без дополнительных расширений. */
export type CodeEditorLanguage =
  | 'json'
  | 'javascript'
  | 'typescript'
  | 'jsx'
  | 'tsx'
  | 'html'
  | 'xml'
  | 'yara';

/** Пропсы HexaUI `CodeViewer` со встроенными языками. */
type HexaCodeViewerProps = ComponentProps<typeof HexaCodeViewer>;

/** Пропсы {@link CodeEditor}: пропсы HexaUI `CodeViewer` без начального значения и своих языков. */
export type CodeEditorProps = Omit<
  HexaCodeViewerProps,
  'initialValue' | 'onChange' | 'language' | 'customLanguages'
> & {
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: FocusEventHandler;
  /** Язык подсветки. По умолчанию — `json`. */
  language?: CodeEditorLanguage;
};

/** Движок — с подпути HexaUI, лениво. */
const CodeEngine = lazy(async () => {
  const module = await import('@kaspersky/hexa-ui/code-viewer');
  return { default: module.CodeViewer as (props: HexaCodeViewerProps) => ReactElement };
});

/** Тот же ли текст: `null` и пустая строка — одно и то же «пусто». */
const sameCode = (a: unknown, b: unknown): boolean => (a ?? '') === (b ?? '');

/** Код с подсветкой: HexaUI `CodeViewer`, загружается при первой отрисовке. */
export function CodeEditor({
  value,
  onChange,
  onBlur,
  language = 'json',
  ...rest
}: CodeEditorProps) {
  const [key, emitted] = useRemountKey<unknown>(value, sameCode);
  return (
    <BlurScope onBlur={onBlur}>
      <Suspense fallback={<Loader />}>
        <CodeEngine
          key={key}
          {...rest}
          language={language as HexaCodeViewerProps['language']}
          initialValue={value ?? ''}
          onChange={(text: string) => {
            emitted(text);
            onChange?.(text);
          }}
        />
      </Suspense>
    </BlurScope>
  );
}
CodeEditor.reformerAdapter = textAdapter;
