/**
 * Нижняя панель со вкладками: **JSON** (raw-исходник схемы, двусторонний — {@link SchemaCodeEditor}),
 * **Модель** и **Registry** (значения `$dataSource` реестра, {@link MockDataEditor}), три **схемы
 * формы** (`validation.ts` / `form.behavior.ts` / `renderer.behavior.ts`, {@link FormSourceEditor})
 * и **Форма** (состояние живой формы). Сворачивается общим флагом `rawJsonOpen`.
 *
 * Схемы формы живут здесь, а не отдельными документами в таб-баре, потому что они принадлежность
 * ФОРМЫ: у них общая с ней рабочая копия, общий dirty и общее закрытие. Рядом — «Модель» и
 * «Форма», то есть ровно тот контекст, в котором правило проверяют глазами.
 *
 * Вкладки описаны списком, а не семью ветками: с четырьмя кнопками и тернарником на четыре уровня
 * это ещё читалось, с семью — уже нет.
 *
 * @module reformer-builder/canvas/BottomPanel
 */

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { BottomTab, MockSection, TabState } from '../store';
import { editorActions, useUi } from '../store';
import { serializeSchema } from '../io/export';
import { synthMock } from '../preview-runtime';
import { FORM_SCHEMA_LABELS, type FormSchemaFile } from '../codegen/regenerate';
import { SchemaCodeEditor } from './SchemaCodeEditor';
import { MockDataEditor } from './MockDataEditor';
import { LiveModelView } from './LiveModelView';
import { FormStateView } from './FormStateView';
import { FormSourceEditor, type SourceState } from './FormSourceEditor';
import { revertToRules } from './revert-to-rules';
import { serializeSection } from './mock-data';
import { cn } from '../lib/cn';

/**
 * Что показывает вкладка «Модель»: ЗАСЕВ (чем форма инициализируется — редактируется) или ЖИВЫЕ
 * значения (что в модели сейчас, после ввода в поля превью — только чтение). Это разные вещи, и
 * раньше вкладка молча показывала первое, хотя подпись обещала второе.
 */
type ModelView = 'seed' | 'live';

/** Секция мок-данных, которую правит вкладка (у остальных секции нет). */
const SECTION: Partial<Record<BottomTab, MockSection>> = {
  model: 'model',
  registry: 'dataSources',
};

/** Вкладка → файл схемы формы. Пусто у вкладок, которые схем не правят. */
const SOURCE_FILE: Partial<Record<BottomTab, FormSchemaFile>> = {
  validation: 'validation.ts',
  formBehavior: 'form.behavior.ts',
  renderBehavior: 'renderer.behavior.ts',
};

/** Порядок и подписи вкладок. Схемы формы — сразу после «Модели». */
const TABS: ReadonlyArray<{ id: BottomTab; label: string; title: string }> = [
  { id: 'raw', label: 'JSON', title: 'Исходник схемы формы' },
  { id: 'model', label: 'Модель', title: 'Модель формы: засев (редактируется) или живые значения' },
  {
    id: 'validation',
    label: FORM_SCHEMA_LABELS['validation.ts'],
    title: 'validation.ts — правила валидации модели',
  },
  {
    id: 'formBehavior',
    label: FORM_SCHEMA_LABELS['form.behavior.ts'],
    title: 'form.behavior.ts — реактивные связи между полями',
  },
  {
    id: 'renderBehavior',
    label: FORM_SCHEMA_LABELS['renderer.behavior.ts'],
    title: 'renderer.behavior.ts — видимость, события и пропсы узлов',
  },
  { id: 'registry', label: 'Registry', title: 'Значения источников $dataSource в превью' },
  {
    id: 'form',
    label: 'Форма',
    title: 'Состояние живой формы: валидность полей, ошибки, лог поведения, сборка схем',
  },
];

/** Подпись состояния файла — она же единственный носитель модели владения в интерфейсе. */
const STATE_LABEL: Record<SourceState, string> = {
  loading: '…',
  generated: 'из правил',
  edited: 'правлен',
  handwritten: 'из проекта',
  unavailable: 'н/д',
};

const STATE_HINT: Record<SourceState, string> = {
  loading: 'Читаем рабочую копию',
  generated: 'Файл собирается из правил формы и обновляется вместе с ними',
  edited: 'Вы правили этот файл — правила его больше не трогают',
  handwritten: 'Файл пришёл из проекта — правила его не трогают',
  unavailable: 'Хранилище браузера выключено, править файл нельзя',
};

export function BottomPanel({ tab }: { tab: TabState }) {
  const { rawJsonOpen, bottomTab: active } = useUi();
  const [resetKey, setResetKey] = useState(0);
  const [modelView, setModelView] = useState<ModelView>('seed');
  const [sourceState, setSourceState] = useState<SourceState>('loading');

  const section = SECTION[active];
  const sourceFile = SOURCE_FILE[active];
  /** Живой вид есть только у «Модели»; у Registry и JSON редактируется сам источник. */
  const live = active === 'model' && modelView === 'live';
  /** «Форма» — не текст: ни счётчика строк, ни «Сбросить» у неё нет. */
  const formState = active === 'form';

  // Число строк активной вкладки (для правого счётчика в заголовке).
  const lines = useMemo(() => {
    if (formState || sourceFile) return 0;
    const text =
      section == null
        ? serializeSchema(tab.schema)
        : (tab.mock?.[section] ?? serializeSection(synthMock(tab.schema), section));
    return text.split('\n').length;
  }, [formState, sourceFile, section, tab.schema, tab.mock]);

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
  const onRevert = () => {
    if (!sourceFile) return;
    void revertToRules(tab, sourceFile).then((done) => {
      if (done) setResetKey((k) => k + 1);
    });
  };

  const tabCls = (t: BottomTab) =>
    cn(
      'h-full flex-none whitespace-nowrap rounded px-2 text-[11.5px]',
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
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => select(t.id)}
              title={t.title}
              className={tabCls(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

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

        {sourceFile && rawJsonOpen && (
          <>
            <span
              title={STATE_HINT[sourceState]}
              className={cn(
                'flex-none whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px]',
                sourceState === 'generated' &&
                  'border-emerald-500/50 bg-emerald-500/10 text-emerald-700',
                (sourceState === 'edited' || sourceState === 'handwritten') &&
                  'border-amber-500/50 bg-amber-500/10 text-amber-700',
                sourceState === 'unavailable' && 'border-destructive/50 text-destructive',
                sourceState === 'loading' && 'border-border'
              )}
            >
              {STATE_LABEL[sourceState]}
            </span>
            <button
              onClick={onRevert}
              disabled={sourceState === 'loading' || sourceState === 'unavailable'}
              title="Собрать файл из правил формы заново (покажем, что изменится)"
              className="flex-none whitespace-nowrap rounded px-2 py-0.5 hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              К правилам
            </button>
          </>
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
        {!live && !formState && !sourceFile && (
          <span className="flex-none pr-1.5">{lines} строк</span>
        )}
      </div>

      {rawJsonOpen && (
        <div className="min-h-0 flex-1 border-t border-border">
          {formState ? (
            <FormStateView />
          ) : sourceFile ? (
            <FormSourceEditor
              key={`${tab.id}:${sourceFile}`}
              tab={tab}
              file={sourceFile}
              onState={setSourceState}
              resetToken={resetKey}
            />
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
