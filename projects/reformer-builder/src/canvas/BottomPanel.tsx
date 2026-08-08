/**
 * Нижняя панель со вкладками: **JSON** (raw-исходник схемы, двусторонний — {@link SchemaCodeEditor}),
 * **Модель** и **Registry** (значения `$dataSource` реестра) — наполняют runtime/live-превью и
 * правятся в {@link MockDataEditor}. Сворачивается общим флагом `rawJsonOpen`. Клик по вкладке
 * разворачивает панель. Кнопка «Сбросить» — к синтезу из схемы (только активная секция).
 *
 * У «Модели» два вида, переключаются в шапке: **Засев** (редактор мок-данных — чем форма
 * инициализируется) и **Живые** ({@link LiveModelView} — что в модели сейчас, после ввода в поля
 * превью, только чтение). Раньше вкладка показывала только засев, хотя подпись обещала живые
 * значения, — отсюда и жалоба «модель не обновляется при вводе».
 *
 * @module reformer-builder/canvas/BottomPanel
 */

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { BottomTab, MockSection, TabState } from '../store';
import { editorActions, useUi } from '../store';
import { serializeSchema } from '../io/export';
import { synthMock } from '../preview-runtime';
import { SchemaCodeEditor } from './SchemaCodeEditor';
import { MockDataEditor } from './MockDataEditor';
import { LiveModelView } from './LiveModelView';
import { FormStateView } from './FormStateView';
import { serializeSection } from './mock-data';
import { cn } from '../lib/cn';

/**
 * Что показывает вкладка «Модель»: ЗАСЕВ (чем форма инициализируется — редактируется) или ЖИВЫЕ
 * значения (что в модели сейчас, после ввода в поля превью — только чтение). Это разные вещи, и
 * раньше вкладка молча показывала первое, хотя подпись обещала второе.
 */
type ModelView = 'seed' | 'live';

/** Секция мок-данных, которую правит вкладка (у `raw` и `form` секции нет — они read-only). */
const SECTION: Record<BottomTab, MockSection | null> = {
  raw: null,
  model: 'model',
  registry: 'dataSources',
  form: null,
};

export function BottomPanel({ tab }: { tab: TabState }) {
  const { rawJsonOpen, bottomTab: active } = useUi();
  const [resetKey, setResetKey] = useState(0);
  const [modelView, setModelView] = useState<ModelView>('seed');
  const section = SECTION[active];
  /** Живой вид есть только у «Модели»; у Registry и JSON редактируется сам источник. */
  const live = active === 'model' && modelView === 'live';
  /** «Форма» — не текст: ни счётчика строк, ни «Сбросить» у неё нет. */
  const formState = active === 'form';

  // Число строк активной вкладки (для правого счётчика в заголовке).
  const lines = useMemo(() => {
    if (formState) return 0;
    const text =
      section == null
        ? serializeSchema(tab.schema)
        : (tab.mock?.[section] ?? serializeSection(synthMock(tab.schema), section));
    return text.split('\n').length;
  }, [formState, section, tab.schema, tab.mock]);

  // Клик по вкладке переключает (в сторе — переживает remount при разворачивании) и разворачивает.
  const select = (t: BottomTab) => {
    editorActions.setBottomTab(t);
    if (!rawJsonOpen) editorActions.toggleRawJson();
  };
  const onReset = () => {
    if (section == null) return;
    editorActions.resetMock(tab.id, section);
    setResetKey((k) => k + 1); // remount редактора → стартовый текст снова из синтеза
  };

  const tabCls = (t: BottomTab) =>
    cn(
      'h-full rounded px-2.5 text-[11.5px]',
      active === t ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted'
    );

  return (
    <div
      className={
        rawJsonOpen
          ? 'flex min-h-0 flex-1 flex-col bg-sidebar'
          : 'flex-none border-t border-border bg-sidebar'
      }
    >
      <div className="flex h-[30px] w-full flex-none items-center gap-1 px-1.5 text-[11.5px] text-muted-foreground">
        <button
          onClick={editorActions.toggleRawJson}
          title={rawJsonOpen ? 'Свернуть' : 'Развернуть'}
          className="grid h-full w-5 flex-none place-items-center rounded hover:bg-muted"
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform', rawJsonOpen && 'rotate-90')}
          />
        </button>
        <button onClick={() => select('raw')} className={tabCls('raw')}>
          JSON
        </button>
        <button
          onClick={() => select('model')}
          title="Модель формы: засев (редактируется) или живые значения"
          className={tabCls('model')}
        >
          Модель
        </button>
        <button
          onClick={() => select('registry')}
          title="Значения источников $dataSource в превью"
          className={tabCls('registry')}
        >
          Registry
        </button>
        <button
          onClick={() => select('form')}
          title="Состояние живой формы: валидность полей, ошибки, лог поведения, сборка схем"
          className={tabCls('form')}
        >
          Форма
        </button>
        <span className="flex-1" />
        {active === 'model' && rawJsonOpen && (
          <div className="flex flex-none gap-0.5 rounded border border-border p-0.5">
            <button
              onClick={() => setModelView('seed')}
              title="Значения, которыми форма инициализируется. Редактируются."
              className={cn(
                'rounded px-1.5',
                modelView === 'seed' ? 'bg-muted text-foreground' : ''
              )}
            >
              Засев
            </button>
            <button
              onClick={() => setModelView('live')}
              title="Что в модели сейчас — с учётом ввода в поля превью. Только чтение."
              className={cn(
                'rounded px-1.5',
                modelView === 'live' ? 'bg-muted text-foreground' : ''
              )}
            >
              Живые
            </button>
          </div>
        )}
        {section != null && rawJsonOpen && !live && !formState && (
          <button
            onClick={onReset}
            title="Сбросить к синтезу из схемы"
            className="flex-none rounded px-2 py-0.5 hover:bg-muted hover:text-foreground"
          >
            Сбросить
          </button>
        )}
        {!live && !formState && <span className="flex-none pr-1.5">{lines} строк</span>}
      </div>
      {rawJsonOpen && (
        <div className="min-h-0 flex-1 border-t border-border">
          {formState ? (
            <FormStateView />
          ) : section == null ? (
            <SchemaCodeEditor schema={tab.schema} />
          ) : live ? (
            <LiveModelView tab={tab} />
          ) : (
            <MockDataEditor key={`${section}:${resetKey}`} tab={tab} section={section} />
          )}
        </div>
      )}
    </div>
  );
}
