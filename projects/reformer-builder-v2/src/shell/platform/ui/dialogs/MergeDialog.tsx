/**
 * Диалог разрешения расхождения. Правила живут в `./merge`, здесь — отрисовка и ввод.
 *
 * ## Три колонки и три исхода
 *
 * Так записано в контракте Э11: база, наша версия, версия источника — и «оставить свою»,
 * «взять источника», «слить вручную». Исхода по умолчанию нет и быть не может: молчаливый
 * выбор стороны это потеря работы, которую обнаружат через день. Поэтому Escape, крестик
 * и щелчок по подложке равны ОТМЕНЕ — расхождение остаётся, файл не тронут.
 *
 * ## Почему компоненты кита, а не разметка руками
 *
 * Требование заказчика к оболочке: интерфейс собирается из `@reformer/ui-kit`. Здесь взяты
 * `dialog` (модальное окно), `tabs` (сравнение против ручного слияния), `button`, `badge`,
 * `scroll-area` и `textarea`. Radix, который они тянут, в сборке уже есть — ради раскладки,
 * вкладок и подсказок.
 *
 * ## Ручное слияние: редактор внедряется, а не импортируется
 *
 * В контракте сказано «ручное слияние идёт в Monaco, потому что у него это уже есть». Monaco
 * здесь — ПЛАГИН, а Host на плагины не ссылается: это перевёрнутая зависимость, и линтер
 * её не пропустит. Поэтому редактор приходит пропсом {@link MergeDialogProps.renderEditor},
 * а без него работает многострочное поле кита — рабочий, хотя и небогатый, запасной путь.
 * Подставить Monaco — дело композиции, у которой есть и то, и другое.
 *
 * @module host/ui/MergeDialog
 */

import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@reformer/ui-kit/tabs';
import { Textarea } from '@reformer/ui-kit/textarea';
import type { I18nService } from '@/shell/platform/services/i18n/i18n';
import type { MergeChoice, MergePlan, MergeSides } from '@/shell/platform/workspace/merge/resolve';
import {
  columnOf,
  describeMergeDialog,
  validateManualMerge,
  type MergeColumn,
  type MergeColumnId,
} from './merge';
import { useLocale } from '@/shell/platform/ui/chrome/usePanels';

/** Что редактор ручного слияния получает от диалога. */
export interface MergeEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly ariaLabel: string;
}

export interface MergeDialogProps {
  readonly open: boolean;
  /** Имя файла — оно, а не путь: путь уезжает в подсказку заголовка. */
  readonly name: string;
  readonly path?: string;
  readonly sides: MergeSides;
  readonly plan: MergePlan;
  readonly i18n: I18nService;
  /** Закрыть, ничего не решив. Расхождение при этом остаётся. */
  readonly onCancel: () => void;
  /** Исход. Текст передаётся только для ручного слияния. */
  readonly onResolve: (choice: MergeChoice, text?: string) => void;
  readonly renderEditor?: (props: MergeEditorProps) => ReactNode;
}

const COLUMN_KEYS: Readonly<Record<MergeColumnId, string>> = {
  base: 'shell.merge.column.base',
  ours: 'shell.merge.column.ours',
  theirs: 'shell.merge.column.theirs',
};

function ColumnView({
  column,
  title,
  emptyLabel,
}: {
  readonly column: MergeColumn;
  readonly title: string;
  readonly emptyLabel: string;
}): ReactElement {
  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-md border border-border">
      <header className="flex items-center justify-between gap-2 border-b border-border px-2 py-1">
        <span className="truncate text-[12px] font-medium">{title}</span>
        {column.available && (column.added > 0 || column.removed > 0) && (
          <Badge variant="secondary" className="font-mono text-[10px]">
            +{column.added} −{column.removed}
          </Badge>
        )}
      </header>
      <ScrollArea className="h-64">
        {column.available ? (
          <ol className="min-w-max py-1 font-mono text-[11px] leading-5">
            {column.lines.map((line, index) => (
              // Ключ по номеру строки: строки не переупорядочиваются, а совпадающие строки
              // в тексте обычны — ключ по содержимому дал бы дубли.
              <li key={index} className="flex gap-2 px-2">
                <span className="w-8 shrink-0 text-right text-muted-foreground select-none">
                  {index + 1}
                </span>
                <span className="whitespace-pre">{line}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-2 py-3 text-[12px] text-muted-foreground">{emptyLabel}</p>
        )}
      </ScrollArea>
    </section>
  );
}

export function MergeDialog({
  open,
  name,
  path,
  sides,
  plan,
  i18n,
  onCancel,
  onResolve,
  renderEditor,
}: MergeDialogProps): ReactElement {
  useLocale(i18n);
  const { t } = i18n;

  const model = useMemo(() => describeMergeDialog(sides, plan), [sides, plan]);
  const [manual, setManual] = useState(model.seed);
  const [tab, setTab] = useState<'compare' | 'manual'>('compare');
  /** Заготовка, под которую набрано нынешнее поле. */
  const [seed, setSeed] = useState(model.seed);

  // Заготовка меняется вместе с расхождением: открыли диалог о другом файле — поле обязано
  // показывать его слияние, а не остатки прошлого. Правка состояния ПРИ ОТРИСОВКЕ, а не
  // эффектом: иначе первый кадр нового расхождения показывал бы чужой текст.
  if (seed !== model.seed) {
    setSeed(model.seed);
    setManual(model.seed);
    setTab('compare');
  }

  const manualCheck = validateManualMerge(manual);
  const canMerge = model.choices.includes('merged');
  const canTakeTheirs = model.choices.includes('theirs');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape, крестик и щелчок по подложке — отмена. Выбрать сторону можно только явно.
        if (!next) onCancel();
      }}
    >
      {/* `aria-describedby` не гасится: описание здесь настоящее, и Radix связывает его сам. */}
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle title={path}>{t('shell.merge.title', { name })}</DialogTitle>
          <DialogDescription>
            {t(`shell.merge.reason.${model.reason}`, { name })}
            {model.conflicts > 0 && ` ${t('shell.merge.conflicts', { count: model.conflicts })}`}
            {model.failure !== undefined &&
              ` ${t('shell.merge.failure', { message: model.failure })}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value === 'manual' ? 'manual' : 'compare');
          }}
        >
          <TabsList>
            <TabsTrigger value="compare">{t('shell.merge.tab.compare')}</TabsTrigger>
            <TabsTrigger value="manual" disabled={!canMerge}>
              {t('shell.merge.tab.manual')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compare">
            <div className="flex gap-2">
              {(['base', 'ours', 'theirs'] as const).map((id) => (
                <ColumnView
                  key={id}
                  column={columnOf(model, id)}
                  title={t(COLUMN_KEYS[id])}
                  emptyLabel={t('shell.merge.column.empty')}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <div className="flex flex-col gap-2">
              <p className="text-[12px] text-muted-foreground">{t('shell.merge.manual.hint')}</p>
              {renderEditor !== undefined ? (
                renderEditor({
                  value: manual,
                  onChange: setManual,
                  ariaLabel: t('shell.merge.manual.label'),
                })
              ) : (
                <Textarea
                  aria-label={t('shell.merge.manual.label')}
                  className="h-64 font-mono text-[11px]"
                  value={manual}
                  onChange={(event) => {
                    setManual(event.target.value);
                  }}
                />
              )}
              {manualCheck === 'markers' && (
                <p role="status" className="text-[12px] text-destructive">
                  {t('shell.merge.manual.markers')}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {t('shell.merge.cancel')}
          </Button>
          {tab === 'manual' ? (
            <Button
              disabled={manualCheck !== 'ok'}
              onClick={() => {
                onResolve('merged', manual);
              }}
            >
              {t('shell.merge.apply')}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={!canTakeTheirs}
                onClick={() => {
                  onResolve('theirs');
                }}
              >
                {t('shell.merge.takeTheirs')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onResolve('ours');
                }}
              >
                {t('shell.merge.keepOurs')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
