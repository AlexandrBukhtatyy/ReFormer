/**
 * Панель проблем: весь свод диагностик проекта одним списком.
 *
 * Третье — и последнее — место, где диагностика видна. Первые два показывают её В МЕСТЕ
 * ошибки (подчёркивание в Monaco, метка на узле канваса) и потому показывают не всё:
 * подчеркнуть можно только то, что нашлось в тексте, а пометить на канвасе — только то,
 * что адресовано узлом. Список показывает **всё**, включая находки, которым места не
 * нашлось, — и в этом его смысл, а не в удобстве.
 *
 * ## Тексты — из словаря Host, а не плагина
 *
 * Заголовок панели и её собственные подписи переводит плагин ({@link FilesHost.useTranslate}),
 * а сами формулировки ошибок — Host, с приставкой `errors.` (см.
 * {@link FilesHost.useDiagnosticMessage}). Разделение проходит не по владельцу строки, а по
 * тому, КТО её завёл: одна ошибка обязана выглядеть одинаково здесь, в редакторе и в
 * подсказке на файле.
 *
 * ## Правила — рядом, в чистом модуле
 *
 * Группировка, порядок строк и счётчики живут в `./diagnostics` и проверяются без DOM.
 * Здесь остаётся то, что без браузера непроверяемо: подписка на службу, щелчок и разметка.
 *
 * ## Быстрые исправления — кнопкой в строке
 *
 * Панель — первое место, где исправление вообще видно: находка здесь показана целиком,
 * включая ту, что не легла ни на узел, ни на диапазон (осиротевшее правило). Кнопка
 * появляется, только если команду исправления сейчас можно выполнить, и это проверяется
 * ДВАЖДЫ: при сборке списка и ещё раз перед вызовом. Между публикацией находки и щелчком
 * плагин, владеющий командой, могли выключить, а кнопка, отказывающая при нажатии, хуже
 * её отсутствия.
 *
 * ## Список пересобирается на КАЖДОЙ отрисовке, и это не оплошность
 *
 * Мемоизировать его нечем: свод меняется и составом (появился файл с ошибкой), и
 * содержимым (в том же файле стало две ошибки вместо одной), а из этих двух зависимость
 * выражает только первое — ссылка на состав. С `useMemo` по составу список замер бы на
 * первой находке каждого файла. Стоимость обхода — десятки записей, и она заведомо меньше
 * стоимости отрисовки, которая уже случилась.
 *
 * @module plugins/files/ui/ProblemsPanel
 */

import { useCallback, useEffect, useReducer, type ComponentType, type ReactElement } from 'react';
import { CircleAlert, CircleX, Info } from 'lucide-react';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@reformer/ui-kit/item';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import type { DiagnosticSeverity, DiagnosticsService, QuickFix, ResourceId } from '@/sdk';
import {
  groupProblems,
  type CommandAccess,
  type ProblemGroup,
  type ProblemRow,
} from '../diagnostics';
import type { FilesHost, Translate } from '../host';

/**
 * Значок строгости.
 *
 * Поштучный импорт из `lucide-react`, а не `@reformer/ui-kit/icon`: тот объявляет себя
 * opt-in, потому что тянет весь набор значков разом (тот же довод, что в
 * `host/ui/ResourceTree`).
 */
const SEVERITY_ICON: Readonly<Record<DiagnosticSeverity, ComponentType<{ className?: string }>>> =
  Object.freeze({ error: CircleX, warning: CircleAlert, info: Info });

/** Цвет значка строгости — токенами кита, чтобы совпасть с тоном пометки в дереве. */
const SEVERITY_CLASS: Readonly<Record<DiagnosticSeverity, string>> = Object.freeze({
  error: 'text-destructive',
  warning: 'text-muted-foreground',
  info: 'text-muted-foreground',
});

/** Пустой состав: одна ссылка вместо нового массива на каждую отрисовку. */
const NO_RESOURCES: readonly ResourceId[] = Object.freeze([]);

/**
 * Запасной перевод кода: сам код.
 *
 * Хук без состояния — ради того, чтобы вызов в теле компонента был БЕЗУСЛОВНЫМ. Выбор
 * реализации происходит один раз (порт композиции не меняется за время жизни панели),
 * а вызывать хук по условию нельзя — подстановка запасного и есть способ этого избежать.
 */
function useDiagnosticCode(): Translate {
  return (code) => code;
}

/**
 * Перерисовка по изменению свода.
 *
 * Тот же приём, что у `useLocale` в оболочке: хук ничего не считает, он делает чужое
 * состояние поводом перерисоваться. Подписка одна на всю панель, а не на ресурс: панель
 * показывает все, и фильтровать по адресу здесь нечего.
 */
function useDiagnosticsRevision(diagnostics: DiagnosticsService | null): void {
  const [, bump] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    if (diagnostics === null) return;
    const subscription = diagnostics.onDidChange(bump);
    return () => {
      subscription.dispose();
    };
  }, [diagnostics]);
}

export interface ProblemsPanelProps {
  readonly host: FilesHost;
  /**
   * Служба диагностик. `null` — её нет в реестре сервисов, и показывать нечего.
   *
   * Плагин берёт её из `ctx.services` сам: она объявлена в `@/sdk`, поэтому проходить
   * через порт композиции ей незачем — в отличие от рабочей области и словаря Host.
   */
  readonly diagnostics: DiagnosticsService | null;
  /**
   * Реестр команд. `null` — исправления не показываются вовсе.
   *
   * Приходит от плагина, а не от композиции: реестр есть только в `activate`. Без него
   * панель остаётся списком находок — ровно тем, чем была до появления исправлений.
   */
  readonly commands?: CommandAccess | null;
}

export function ProblemsPanel({
  host,
  diagnostics,
  commands = null,
}: ProblemsPanelProps): ReactElement {
  const t = host.useTranslate();
  const useMessage = host.useDiagnosticMessage ?? useDiagnosticCode;
  const message = useMessage();
  // Подписи исправлений — тоже словарь Host, но БЕЗ приставки `errors.`: `QuickFix.titleKey`
  // уже полный ключ (`quickfix.*`). Отсюда и второй перевод рядом с первым.
  const useFixTitle = host.useQuickFixTitle ?? useDiagnosticCode;
  const fixTitle = useFixTitle();
  useDiagnosticsRevision(diagnostics);

  const runFix = useCallback(
    (fix: QuickFix) => {
      // Реестр спрашивается ПЕРЕД вызовом, хотя кнопка уже отобрана при сборке списка:
      // между сборкой и щелчком плагин, владеющий командой, могли выключить. Тишина здесь
      // честнее отказа — в следующем кадре кнопки не будет вовсе.
      if (commands === null || !commands.has(fix.commandId)) return;
      commands.run(fix.commandId, fix.args);
    },
    [commands]
  );

  const groups = groupProblems(
    diagnostics?.resources() ?? NO_RESOURCES,
    (id) => diagnostics?.get(id) ?? [],
    (id) => {
      // Имя спрашивается у открытого документа: у службы диагностик его нет, а разбирать
      // идентификатор ресурса плагину нельзя — путевая арифметика принадлежит платформе.
      // Закрытый документ (сайдкар с ошибкой сборки) называет порт — той же арифметикой.
      const ref = host.documentOf(id)?.ref;
      if (ref !== undefined) return { name: ref.name, path: ref.path };
      return host.nameOf?.(id) ?? null;
    },
    commands === null ? undefined : (commandId) => commands.has(commandId)
  );

  if (groups.length === 0) {
    return (
      <Empty className="flex-1 border-0">
        <EmptyHeader>
          <EmptyTitle className="text-sm font-medium">{t('problems.empty.title')}</EmptyTitle>
          <EmptyDescription className="text-xs">{t('problems.empty.description')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Своей шапки у панели НЕТ: имя ей даёт оболочка — вкладкой нижнего дока, а число
          находок — значок на той же вкладке. Строка «Проблемы 3» под вкладкой «Проблемы 3»
          повторяла и то и другое, отнимая высоту у списка, ради которого панель открыта. */}
      <ScrollArea className="min-h-0 flex-1">
        <ItemGroup role="list" aria-label={t('problems.title')}>
          {groups.map((group) => (
            <GroupView
              key={group.resource}
              group={group}
              message={message}
              fixTitle={fixTitle}
              onFix={runFix}
              onOpen={host.openResource}
              t={t}
            />
          ))}
        </ItemGroup>
      </ScrollArea>
    </div>
  );
}

/** Шапка ресурса и его строки. Отдельный компонент — ради ключа на группе, а не на фрагменте. */
function GroupView({
  group,
  message,
  fixTitle,
  onFix,
  onOpen,
  t,
}: {
  group: ProblemGroup;
  message: Translate;
  fixTitle: Translate;
  onFix: (fix: QuickFix) => void;
  onOpen?: (id: ResourceId) => void;
  t: Translate;
}): ReactElement {
  return (
    <>
      <Item size="sm" className="gap-1.5 rounded-none px-3 py-1">
        <ItemContent className="min-w-0 gap-0">
          <ItemTitle
            className="text-muted-foreground truncate text-[11px] font-medium"
            title={group.path ?? group.resource}
          >
            {group.name}
          </ItemTitle>
        </ItemContent>
        <ItemActions>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {group.summary.total}
          </Badge>
        </ItemActions>
      </Item>
      {group.rows.map((row) => (
        <RowView
          key={row.key}
          row={row}
          message={message}
          fixTitle={fixTitle}
          onFix={onFix}
          onOpen={onOpen}
          t={t}
        />
      ))}
    </>
  );
}

function RowView({
  row,
  message,
  fixTitle,
  onFix,
  onOpen,
  t,
}: {
  row: ProblemRow;
  message: Translate;
  fixTitle: Translate;
  onFix: (fix: QuickFix) => void;
  onOpen?: (id: ResourceId) => void;
  t: Translate;
}): ReactElement {
  const Icon = SEVERITY_ICON[row.severity];
  const clickable = onOpen !== undefined;

  return (
    <Item
      size="sm"
      role="listitem"
      className={
        clickable
          ? 'hover:bg-accent/50 cursor-pointer gap-1.5 rounded-none py-1 pr-3 pl-6 text-[12px]'
          : 'gap-1.5 rounded-none py-1 pr-3 pl-6 text-[12px]'
      }
      // Кнопкой строку не делаем: внутри неё своя разметка, а `button` внутри `button`
      // недопустим. Переход остаётся щелчком по строке целиком — как в дереве ресурсов.
      onClick={
        onOpen === undefined
          ? undefined
          : () => {
              onOpen(row.resource);
            }
      }
    >
      <ItemMedia className="size-4">
        <Icon className={`size-3.5 ${SEVERITY_CLASS[row.severity]}`} />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0">
        <ItemTitle className="text-[12px] font-normal">{message(row.code, row.params)}</ItemTitle>
        <ItemDescription className="text-muted-foreground truncate text-[10px]">
          {t('problems.origin', { source: row.source, code: row.code })}
        </ItemDescription>
      </ItemContent>
      {(row.fixes.length > 0 || row.target.kind === 'node') && (
        <ItemActions className="gap-1">
          {row.fixes.map((fix) => (
            <Button
              key={`${fix.commandId}:${fix.titleKey}`}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              data-fix={fix.commandId}
              onClick={(event) => {
                // Щелчок по кнопке — только исправление: переход к файлу он не делает,
                // иначе починка уводила бы человека со списка, который он разбирает.
                event.stopPropagation();
                onFix(fix);
              }}
            >
              {fixTitle(fix.titleKey)}
            </Button>
          ))}
          {row.target.kind === 'node' && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {row.target.nodeId}
            </Badge>
          )}
        </ItemActions>
      )}
    </Item>
  );
}
