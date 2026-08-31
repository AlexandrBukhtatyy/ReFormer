import * as React from 'react';
import { ChevronsUpDownIcon, SearchIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
import { Button } from '@/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';
import { Tree, type TreeHandle, type TreeNode, type TreeSelectable } from '@/components/tree';

// ComboboxTree — тот же рецепт «триггер + Popover», что и у остальных вариантов комбобокса,
// но список в поповере иерархический: там стоит `Tree` кита.
//
// ## Почему здесь НЕТ cmdk, хотя он есть у соседних вариантов
//
// Command (cmdk) не совместим с деревом сразу по трём причинам, и ни одна не лечится настройкой:
//
//  - при непустом поиске он РАЗМОНТИРУЕТ несовпавшие пункты (`if (!x) return null`), а вместе
//    с каталогом исчезают и его дети — иерархия рассыпается от первого же символа;
//  - он ФИЗИЧЕСКИ переставляет узлы (`appendChild` мимо React), пересортировывая их по скору
//    fuzzy-поиска, — отступы уровней после этого означают не то, что показывают;
//  - его клавиатура ходит по РЕАЛЬНОМУ DOM (`querySelectorAll('[cmdk-item=""]')`), а строки
//    вне окна виртуализации не существуют — стрелка вниз до них не доходит.
//
// Отключить всё это можно только `shouldFilter={false}`, и тогда от cmdk остаётся клавиатура,
// которая деревом всё равно не годится: у него свои стрелки влево/вправо. Прецедент отказа
// в ките уже есть — `SelectMulti` по тем же соображениям строит свой listbox в Popover.
//
// Поиск поэтому свой: поле над деревом отдаёт строку в проп `search`, а фильтрацию с
// достраиванием пути до совпадения делает само дерево.

/** Сколько строк дерева показать в поповере до появления прокрутки. */
const DEFAULT_MAX_ROWS = 12;

/** Ищет узел по адресу в объявленном дереве. Прочитанные лениво уровни отсюда не видны. */
export function findTreeNode(
  nodes: readonly TreeNode[] | undefined,
  id: string
): TreeNode | undefined {
  for (const node of nodes ?? []) {
    if (node.id === id) return node;
    const found = findTreeNode(node.children, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Адреса предков узла — то, что нужно раскрыть, чтобы выбранное было видно при открытии.
 *
 * Считается по объявленному дереву. У ленивого источника предки неизвестны до чтения уровня,
 * и это не упущение: узнать их можно только сходив за каждым уровнем, то есть обойдя источник
 * целиком ради подсветки одной строки.
 */
export function expandedPathTo(
  nodes: readonly TreeNode[] | undefined,
  id: string | null | undefined
): string[] {
  if (id === null || id === undefined) return [];
  const path: string[] = [];
  const walk = (list: readonly TreeNode[] | undefined, ancestors: string[]): boolean => {
    for (const node of list ?? []) {
      if (node.id === id) {
        path.push(...ancestors);
        return true;
      }
      if (walk(node.children, [...ancestors, node.id])) return true;
    }
    return false;
  };
  walk(nodes, []);
  return path;
}

/**
 * Поле поиска над деревом. Разметка повторяет `CommandInput`, потому что это одно и то же
 * место интерфейса: человек не должен по виду отличать поиск в дереве от поиска в списке.
 */
export function TreeSearchField({
  value,
  onChange,
  placeholder,
  onArrowDown,
  'data-testid': dataTestId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Стрелка вниз уводит из поля в дерево — дальше работает клавиатура самого дерева. */
  onArrowDown: () => void;
  'data-testid'?: string;
}): React.ReactElement {
  return (
    <div data-slot="combobox-tree-search" className="flex h-9 items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        data-testid={dataTestId}
        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={placeholder ?? 'Поиск...'}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          // Иначе стрелка двигала бы каретку в поле, а не курсор в дереве.
          event.preventDefault();
          onArrowDown();
        }}
      />
    </div>
  );
}

/** Props компонента {@link ComboboxTree}. */
export interface ComboboxTreeProps {
  className?: string;
  /** Выбранный узел (`node.id`). `null` — ничего не выбрано. */
  value?: string | null;
  /** Обработчик выбора. При очистке приходит `null`. */
  onChange?: (value: string | null) => void;
  /** Срабатывает при закрытии popover (снятие фокуса). */
  onBlur?: () => void;
  /** Узлы верхнего уровня. Не задан вместе с `loadChildren`. */
  nodes?: readonly TreeNode[];
  /** Ленивое чтение уровня при первом раскрытии ветки; `null` — верхний уровень. */
  loadChildren?: (node: TreeNode | null) => Promise<readonly TreeNode[]>;
  /** Ветки, раскрытые при открытии списка. Путь до выбранного узла раскрывается и без него. */
  defaultExpandedIds?: readonly string[];
  /**
   * Что можно выбрать. По умолчанию `'leaf'` — выбор файла: щелчок по каталогу его раскрывает.
   * `'all'` разрешает выбрать и каталог.
   */
  selectable?: TreeSelectable;
  /** Подсказка в триггере, пока ничего не выбрано. По умолчанию `'Выберите файл...'`. */
  placeholder?: string;
  /** Подсказка в поле поиска. По умолчанию `'Поиск...'`. */
  searchPlaceholder?: string;
  /** Текст пустого состояния. По умолчанию `'Ничего не найдено'`. */
  emptyText?: string;
  /** Показывать ли крестик очистки справа от значения. По умолчанию `false`. */
  clearable?: boolean;
  /** Сколько строк дерева показать до появления прокрутки. По умолчанию 12. */
  maxRows?: number;
  disabled?: boolean;
  /** id корневого элемента — по нему форма связывает подпись, описание и сообщение об ошибке. */
  id?: string;
  /**
   * Префикс `data-testid`. Части поля адресуются им же: сам он на триггере, `-search` на поле
   * поиска, `-clear` на крестике, `-tree` на корне дерева и `-tree-<id узла>` на его строках.
   * Триггер и дерево получают РАЗНЫЕ значения намеренно: одно и то же на двух элементах
   * означало бы, что при открытом поповере селектор находит два узла вместо одного.
   */
  'data-testid'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-required'?: boolean | 'true' | 'false';
}

/**
 * Императивный handle {@link ComboboxTree}: baseline {@link FieldHandle} на кнопке-триггере +
 * управление popover'ом и уровнями дерева.
 */
export interface ComboboxTreeHandle extends FieldHandle {
  /** Открыть popover с деревом. */
  open(): void;
  /** Закрыть popover (эмитит `onBlur`, как обычное закрытие). */
  close(): void;
  /** Сбросить выбранное значение в `null`. */
  clear(): void;
  /**
   * Перечитать уровень дерева: файл создан, удалён, переименован. `null` — верхний уровень.
   * Действует, только пока popover открыт: закрытый Radix содержимое размонтирует, и
   * перечитывать нечего — следующее открытие прочитает уровень заново.
   */
  refresh(id?: string | null): Promise<void>;
}

/**
 * Combobox с деревом (вариант `tree`): выбор одного узла — как правило файла — из иерархии.
 *
 * Триггер показывает подпись выбранного узла, а если узел пришёл из лениво прочитанного
 * уровня и в объявленном дереве его нет — сам адрес. Для файлов это не компромисс, а то,
 * что и нужно видеть: путь однозначен, имя файла — нет.
 */
const ComboboxTree = React.forwardRef<ComboboxTreeHandle, ComboboxTreeProps>(function ComboboxTree(
  {
    className,
    value,
    onChange,
    onBlur,
    nodes,
    loadChildren,
    defaultExpandedIds,
    selectable = 'leaf',
    placeholder,
    searchPlaceholder,
    emptyText,
    clearable = false,
    maxRows = DEFAULT_MAX_ROWS,
    disabled,
    id,
    'data-testid': dataTestId,
    'aria-invalid': ariaInvalid,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-required': ariaRequired,
  },
  ref
) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const treeRef = React.useRef<TreeHandle | null>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      ...makeElementFieldHandle(triggerRef),
      open: () => setOpen(true),
      close: () => setOpen(false),
      clear: () => onChange?.(null),
      refresh: async (nodeId?: string | null) => {
        await treeRef.current?.refresh(nodeId);
      },
    }),
    [onChange]
  );

  // Узел мог прийти из лениво прочитанного уровня — тогда подписи у нас нет, и показываем адрес.
  const selectedLabel = React.useMemo(() => {
    if (value == null || value === '') return undefined;
    return findTreeNode(nodes, value)?.label ?? value;
  }, [nodes, value]);

  const expanded = React.useMemo(
    () => [...new Set([...(defaultExpandedIds ?? []), ...expandedPathTo(nodes, value)])],
    [defaultExpandedIds, nodes, value]
  );

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    if (!next) {
      setSearch('');
      onBlur?.();
    }
  };

  const handleActivate = (node: TreeNode): void => {
    // Повторный выбор той же строки при `clearable` сбрасывает значение — то же поведение,
    // что у одиночного Combobox.
    onChange?.(clearable && node.id === value ? null : node.id);
    setSearch('');
    setOpen(false);
  };

  const handleClear = (event: React.MouseEvent): void => {
    event.stopPropagation();
    onChange?.(null);
  };

  const showClearButton = clearable && value != null && value !== '' && !disabled;

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            id={id}
            data-testid={dataTestId}
            title={selectedLabel}
            aria-invalid={ariaInvalid}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-errormessage={ariaErrorMessage}
            aria-required={ariaRequired}
            className={cn(
              'w-full justify-between font-normal',
              showClearButton && 'pr-14',
              className
            )}
          >
            <span
              data-slot="combobox-tree-value"
              className={cn('truncate', selectedLabel === undefined && 'text-muted-foreground')}
            >
              {selectedLabel ?? placeholder ?? 'Выберите файл...'}
            </span>
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <TreeSearchField
            value={search}
            onChange={setSearch}
            placeholder={searchPlaceholder}
            onArrowDown={() => treeRef.current?.focus()}
            data-testid={dataTestId === undefined ? undefined : `${dataTestId}-search`}
          />
          {/* `defaultSelectedId`, а не управляемое выделение: в списке курсор ходит по строкам,
              и это НЕ выбор значения — значение меняет только запуск строки. Содержимое
              поповера Radix размонтирует при закрытии, поэтому следующее открытие снова
              встанет на текущее значение. */}
          <Tree
            ref={treeRef}
            nodes={nodes}
            loadChildren={loadChildren}
            defaultExpandedIds={expanded}
            defaultSelectedId={value ?? null}
            selectable={selectable}
            search={search}
            maxRows={maxRows}
            emptyText={emptyText ?? 'Ничего не найдено'}
            data-testid={dataTestId === undefined ? undefined : `${dataTestId}-tree`}
            aria-labelledby={ariaLabelledBy}
            onActivate={handleActivate}
          />
        </PopoverContent>
      </Popover>

      {showClearButton && (
        <button
          type="button"
          className="absolute top-1/2 right-8 z-10 -translate-y-1/2 transform cursor-pointer border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
          onClick={handleClear}
          aria-label="Clear selection"
          data-testid={dataTestId === undefined ? undefined : `${dataTestId}-clear`}
          tabIndex={-1}
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
});
ComboboxTree.displayName = 'ComboboxTree';

export { ComboboxTree };
