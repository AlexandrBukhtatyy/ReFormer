/**
 * Панель шаблонов форм: сворачиваемые группы по видам, плотный список и контекстное меню.
 *
 * Вид и повадки взяты у первой версии, и это не ностальгия, а вывод из того, ЧТО делает панель.
 * Она — навигация: «какие заготовки у меня есть». Навигационный список читают взглядом, поэтому
 * строка обязана быть в одну линию (значок + имя), а разделы — сворачиваться со счётчиком, как
 * категории палитры компонентов рядом. Карточка на три строки с бейджем и кнопкой, стоявшая
 * здесь раньше, показывала три шаблона там, где помещается десять, и заставляла читать вид
 * шаблона у каждой строки — при том, что вид уже написан в заголовке раздела.
 *
 * ## Действия — в контекстном меню, а не в строке
 *
 * Кнопка «Удалить» в каждой строке платит постоянным присутствием за действие, которое делают
 * раз в месяц, и ставит опасное рядом с обычным щелчком. Правый щелчок — та же дверь, что
 * в дереве ресурсов: одинаковая привычка на двух списках дешевле, чем два разных способа.
 *
 * ## Панель не спрашивает имя формы заранее
 *
 * Имя, каталог и состав файлов — вопросы ОДНОГО решения «беру этот шаблон», и заданы они там,
 * где принимается решение: в {@link TemplateDialogs}. Панель остаётся списком.
 *
 * Список перечитывается по требованию, а не подпиской: хранилища ходят в источник и в браузер,
 * и обновлять их на каждый кадр было бы обходом файловой системы за кадр. Перечитывание
 * вызывают четыре события — открытие панели, смена кита, кнопка в шапке и завершение операции.
 *
 * @module plugins/templates/ui/TemplatesPanel
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Button } from '@reformer/ui-kit/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@reformer/ui-kit/context-menu';
import { Item, ItemContent, ItemMedia, ItemTitle } from '@reformer/ui-kit/item';
import { ChevronRight, FileCode } from 'lucide-react';
import { canRemove, canUpdate, type FormTemplate, type TemplateSource } from '../contract';
import type { TemplateStore } from '../contract';
import type { TemplatesHost, Translate } from '../host';
import { listTemplates, SOURCE_ORDER, storeOf, type OperationResult } from '../content/operations';
import type { TemplatesRefresh } from '../content/refresh';
import { TemplateDialogs, type TemplateDialog } from './TemplateDialogs';

export interface TemplatesPanelProps {
  readonly host: TemplatesHost;
  /** Хранилища читаются лениво: их вносят и снимают, в том числе чужие плагины. */
  readonly stores: () => readonly TemplateStore[];
  /**
   * Повод перечитать список, приходящий снаружи тела панели: кнопка в шапке дока и команда.
   * Без него список перечитывается только сам — при открытии панели, смене кита и после
   * своих же операций.
   */
  readonly refresh?: TemplatesRefresh;
}

/** Что можно сделать с шаблоном этого вида: зависит от хранилища, а не от вида. */
interface GroupAbilities {
  readonly renamable: boolean;
  readonly removable: boolean;
}

export function TemplatesPanel({ host, stores, refresh }: TemplatesPanelProps): ReactNode {
  const t = host.useTranslate();
  const documentId = host.useActiveDocument();

  const [templates, setTemplates] = useState<readonly FormTemplate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Partial<Record<TemplateSource, boolean>>>({});
  const [dialog, setDialog] = useState<TemplateDialog | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);

  const reload = useCallback(() => {
    void listTemplates(stores()).then(setTemplates);
  }, [stores]);

  useEffect(() => {
    reload();
    // Кит меняет ВЫВОД встроенных шаблонов: они печатаются кодогеном под активный кит,
    // поэтому список после переключения кита обязан перечитаться.
    const onKit = host.onDidChangeKit(reload);
    // Кнопка «Обновить» живёт в шапке дока, то есть в другом поддереве: она не зовёт
    // перечитывание напрямую, а объявляет повод — см. `../refresh`.
    const onRequest = refresh?.subscribe(reload) ?? null;
    return () => {
      onKit.dispose();
      onRequest?.dispose();
    };
  }, [host, refresh, reload]);

  // Пустые группы не показываем: без проекта нет «Проекта», без хранилища браузера —
  // «Локальных». Пустой заголовок сообщал бы об отсутствии дважды.
  const groups = useMemo(
    () =>
      SOURCE_ORDER.map(
        (source) => [source, templates.filter((template) => template.source === source)] as const
      ).filter(([, list]) => list.length > 0),
    [templates]
  );

  const abilitiesOf = useCallback(
    (source: TemplateSource): GroupAbilities => {
      const store = storeOf(stores(), source);
      return {
        renamable: store !== null && canUpdate(store),
        removable: store !== null && canRemove(store),
      };
    },
    [stores]
  );

  const finish = useCallback(
    (outcome: OperationResult) => {
      setResult(outcome);
      reload();
    },
    [reload]
  );

  return (
    <div className="flex w-full min-w-0 flex-col">
      {result === null ? null : (
        <Alert variant={result.ok ? 'default' : 'destructive'} className="rounded-none border-x-0">
          <AlertDescription className="text-[11px]">
            {t(result.messageKey, result.params)}
          </AlertDescription>
        </Alert>
      )}

      {/* Своей области прокрутки здесь нет намеренно: тело панели монтируется ВНУТРИ
          `ScrollArea` оболочки (`host/ui/Shell`), и вторая полоса встала бы поверх первой. */}
      <div className="w-full py-1">
        {groups.length === 0 ? (
          <div className="text-muted-foreground px-3 py-3 text-[11px] leading-relaxed">
            <div className="text-foreground text-[12px] font-medium">{t('empty.none')}</div>
            <div className="mt-1">{t('empty.none.detail')}</div>
          </div>
        ) : (
          groups.map(([source, list]) => (
            <TemplateGroup
              key={source}
              source={source}
              templates={list}
              open={collapsed[source] !== true}
              selected={selected}
              abilities={abilitiesOf(source)}
              t={t}
              onToggle={() =>
                setCollapsed((state) => ({ ...state, [source]: state[source] !== true }))
              }
              onSelect={setSelected}
              onCommand={setDialog}
            />
          ))
        )}
      </div>

      <TemplateDialogs
        dialog={dialog}
        host={host}
        documentId={documentId}
        stores={stores}
        t={t}
        onClose={() => setDialog(null)}
        onDone={finish}
      />
    </div>
  );
}

interface TemplateGroupProps {
  readonly source: TemplateSource;
  readonly templates: readonly FormTemplate[];
  readonly open: boolean;
  readonly selected: string | null;
  readonly abilities: GroupAbilities;
  readonly t: Translate;
  readonly onToggle: () => void;
  readonly onSelect: (id: string) => void;
  readonly onCommand: (dialog: TemplateDialog) => void;
}

function TemplateGroup({
  source,
  templates,
  open,
  selected,
  abilities,
  t,
  onToggle,
  onSelect,
  onCommand,
}: TemplateGroupProps): ReactNode {
  return (
    <div className="border-border border-b last:border-b-0">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        data-testid={`template-group-${source}`}
        className="text-muted-foreground hover:text-foreground h-7 w-full justify-start gap-1.5 rounded-none px-3 text-[10px] font-semibold tracking-wider uppercase"
        onClick={onToggle}
      >
        <ChevronRight
          aria-hidden="true"
          className={open ? 'size-3 flex-none rotate-90' : 'size-3 flex-none'}
        />
        <span className="min-w-0 flex-1 truncate text-left">{t(`group.${source}`)}</span>
        <span className="text-muted-foreground/50 flex-none font-mono text-[10px] font-normal">
          {templates.length}
        </span>
      </Button>

      {open ? (
        <div className="flex flex-col px-1 pb-1.5">
          {templates.map((template) => (
            <TemplateRow
              key={`${source}:${template.id}`}
              template={template}
              active={template.id === selected}
              abilities={abilities}
              t={t}
              onSelect={onSelect}
              onCommand={onCommand}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface TemplateRowProps {
  readonly template: FormTemplate;
  readonly active: boolean;
  readonly abilities: GroupAbilities;
  readonly t: Translate;
  readonly onSelect: (id: string) => void;
  readonly onCommand: (dialog: TemplateDialog) => void;
}

function TemplateRow({
  template,
  active,
  abilities,
  t,
  onSelect,
  onCommand,
}: TemplateRowProps): ReactNode {
  const generate = (): void => onCommand({ kind: 'generate', template });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Item
          size="sm"
          // Строка выбирается щелчком: `Item` кита — презентационный компонент, роли кнопки
          // он не несёт, поэтому её приходится объявлять здесь.
          role="button"
          tabIndex={0}
          aria-pressed={active}
          data-testid={`template-row-${template.source}-${template.id}`}
          title={`${template.description ?? template.name} · ${t('template.files', {
            count: template.files.length,
          })}`}
          className={
            active
              ? 'bg-accent text-accent-foreground h-6 cursor-pointer gap-1.5 rounded-md border-0 px-2 py-0 text-[12px]'
              : 'hover:bg-accent/50 h-6 cursor-pointer gap-1.5 rounded-md border-0 px-2 py-0 text-[12px]'
          }
          // Щелчок — то самое, ради чего шаблон открывают: создать по нему форму. Подсветка
          // строки при этом остаётся (видно, с чего начали), но она следствие действия,
          // а не само действие: строка, отвечающая на щелчок только цветом, заставляет
          // искать, чем же её применить.
          onClick={() => {
            onSelect(template.id);
            generate();
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onSelect(template.id);
            generate();
          }}
        >
          <ItemMedia className="size-3.5 shrink-0">
            <FileCode aria-hidden="true" className="text-primary size-3.5" />
          </ItemMedia>
          <ItemContent className="min-w-0 gap-0">
            <ItemTitle className="truncate text-[12px] font-normal">{template.name}</ItemTitle>
          </ItemContent>
        </Item>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={generate}>{t('menu.generate')}</ContextMenuItem>
        {abilities.renamable || abilities.removable ? <ContextMenuSeparator /> : null}
        {abilities.renamable ? (
          <ContextMenuItem onClick={() => onCommand({ kind: 'rename', template })}>
            {t('menu.rename')}
          </ContextMenuItem>
        ) : null}
        {abilities.removable ? (
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onCommand({ kind: 'remove', template })}
          >
            {t('action.remove')}
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
