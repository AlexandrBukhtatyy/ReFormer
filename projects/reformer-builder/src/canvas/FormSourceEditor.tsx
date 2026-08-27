/**
 * Тело вкладки одной схемы формы (`validation.ts` / `form.behavior.ts` / `renderer.behavior.ts`)
 * в нижней панели — без заголовка и кнопок, chrome в {@link BottomPanel}.
 *
 * Источник истины — файл рабочей копии вкладки (`io/opfs`), а не поле стора: у формы, собранной в
 * билдере, файлов раньше не существовало вовсе, и текст пришлось бы держать отдельно от того, что
 * исполняет живое превью. Здесь буфер и есть файл: правка уходит в копию с дебаунсом, превью
 * пересобирается оттуда же.
 *
 * Чтение асинхронно — OPFS в главном потоке синхронного доступа не даёт, — поэтому у вкладки есть
 * состояние загрузки. Мигать пустым редактором вместо него нельзя: пустой Monaco читается как
 * «файл пуст», а не как «ещё не прочитан».
 *
 * @module reformer-builder/canvas/FormSourceEditor
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useUi, type TabState } from '../store';
import { readWorkdirFile, writeWorkdirFile } from '../io/opfs';
import { syncWorkdir } from '../app/workdir-actions';
import { originOf, type FormSchemaFile } from '../codegen/regenerate';
import { reloadLiveForm } from './useLiveForm';

const CodeEditor = lazy(() => import('./CodeEditor'));

/** Задержка записи в рабочую копию. Та же, что у пересборки превью, — иначе они спорят. */
const WRITE_DEBOUNCE_MS = 400;

/** Состояние файла для пометки в шапке вкладки. */
export type SourceState = 'loading' | 'generated' | 'edited' | 'handwritten' | 'unavailable';

export function FormSourceEditor({
  tab,
  file,
  onState,
  resetToken,
}: {
  tab: TabState;
  file: FormSchemaFile;
  /** Сообщить панели, что показывать в пометке. */
  onState: (state: SourceState) => void;
  /** Меняется при «вернуть к правилам» — перечитываем файл. */
  resetToken: number;
}) {
  const { theme } = useUi();
  const [text, setText] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /**
   * Текст, каким его отдала рабочая копия.
   *
   * Признак «пользователь правил» — расхождение с ним, а не фокус. Через фокус это сначала и
   * было сделано, и получалось хуже: правка, пришедшая не с клавиатуры (вставка, форматтер,
   * будущая правка ассистентом прямо в файл), фокуса не поднимает и потому не сохранялась бы.
   * Сравнение с прочитанным заодно честнее отвечает на вопрос, ради которого guard и заведён, —
   * «не записываем ли мы обратно то, что только что прочитали».
   */
  const loadedRef = useRef<string | null>(null);
  const tabId = tab.id;

  // Чтение: сначала синхронизируем копию (сгенерированные файлы догоняют схему), потом читаем.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    onState('loading');
    void (async () => {
      const all = await syncWorkdir(tab);
      if (cancelled) return;
      if (!all) {
        onState('unavailable');
        setText(null);
        setReady(true);
        return;
      }
      const content = all[file] ?? (await readWorkdirFile(tabId, file)) ?? '';
      if (cancelled) return;
      loadedRef.current = content;
      setText(content);
      onState(originOf(content));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // `tab` целиком в зависимостях не нужен: перечитывать надо при смене вкладки, файла и сброса.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, file, resetToken]);

  // Запись: дебаунс, потом файл и пересборка превью. Пока не читали — не пишем.
  useEffect(() => {
    if (!ready || text == null || text === loadedRef.current) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const okWrite = await writeWorkdirFile(tabId, file, text);
        if (!okWrite) return;
        loadedRef.current = text;
        onState(originOf(text));
        reloadLiveForm();
      })();
    }, WRITE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, ready, tabId, file]);

  const onChange = useCallback((v: string) => setText(v), []);

  if (!ready) {
    return (
      <div className="grid h-full place-items-center text-xs text-muted-foreground">
        Чтение рабочей копии…
      </div>
    );
  }
  if (text == null) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-xs text-muted-foreground">
        Рабочая копия недоступна — хранилище браузера выключено.
        <br />
        Схемы формы уедут при экспорте, но править их здесь нельзя.
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="grid h-full place-items-center text-xs text-muted-foreground">
          Загрузка редактора…
        </div>
      }
    >
      <CodeEditor value={text} language="typescript" theme={theme} onChange={onChange} />
    </Suspense>
  );
}
