/**
 * Текстовый редактор — тот, который берётся за файл, когда за него не взялся никто другой.
 *
 * ## Почему буфер компонента, а не `document.getText()` напрямую
 *
 * `writeText` рабочей области асинхронна: она материализует ресурс, пишет в OPFS и только
 * потом обновляет буфер документа. Управляемое поле, читающее `getText()`, отставало бы
 * от набора на длину этой цепочки — то есть каретка прыгала бы к концу на каждом символе.
 * Поэтому истина во время набора — состояние компонента, а из документа принимается только
 * ЧУЖОЕ изменение (откат, слияние, правка ассистентом): своё эхо отсеивается по последнему
 * отправленному тексту.
 *
 * ## Чего здесь нет
 *
 * Подсветки, сворачивания, поиска, отмены сверх браузерной. Это не «пока нет»: настоящий
 * редактор кода придёт своим плагином и выиграет выбор приоритетом ({@link canOpen} здесь
 * отвечает минимальным). Задача этого — быть тем, из-за чего открытие файла не упирается
 * в «редактора нет».
 *
 * @module plugins/files/TextEditor
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Textarea } from '@reformer/ui-kit/textarea';
import type { ResourceId } from '@/sdk';
import type { FilesDocument, FilesHost } from './host';

/** Тело редактора над УЖЕ открытым документом: он есть всегда, иначе компонент не рисуется. */
function Body({
  host,
  document,
  documentId,
}: {
  host: FilesHost;
  document: FilesDocument;
  documentId: ResourceId;
}): ReactElement {
  const t = host.useTranslate();
  const [value, setValue] = useState(() => document.getText());
  /** Последний текст, о котором знает документ: им отсеивается собственное эхо. */
  const known = useRef(value);

  useEffect(() => {
    const subscription = document.onDidChangeContent((text) => {
      if (text === known.current) return;
      known.current = text;
      setValue(text);
    });
    return () => {
      subscription.dispose();
    };
  }, [document]);

  return (
    <Textarea
      aria-label={t('editor.label')}
      spellCheck={false}
      value={value}
      onChange={(event) => {
        const text = event.target.value;
        known.current = text;
        setValue(text);
        // В рабочую копию, а не в источник: наружу выходит только `save`. Отказ записи
        // не откатывает набранное — истина уже в поле, и терять её из-за сбоя хранилища
        // хуже, чем расходиться с рабочей копией до следующего нажатия.
        void host.writeText(documentId, text).catch((error: unknown) => {
          console.error(`[files] правка не записана в рабочую копию: ${documentId}`, error);
        });
      }}
      className="h-full min-h-0 flex-1 resize-none rounded-none border-0 font-mono text-[12px] leading-[1.5] shadow-none focus-visible:ring-0"
    />
  );
}

/**
 * Редактор для вкладки. Документ берётся у платформы по идентификатору: держать его пропом
 * значило бы, что оболочка знает, кому какой документ показывать, — а она знает только пары
 * «редактор + ресурс».
 */
export function TextEditor({
  host,
  documentId,
}: {
  host: FilesHost;
  documentId: ResourceId;
}): ReactElement | null {
  const document = host.documentOf(documentId);
  if (document === null) return null;
  return <Body host={host} document={document} documentId={documentId} />;
}
