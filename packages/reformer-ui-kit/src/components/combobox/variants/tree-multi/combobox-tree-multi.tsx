import * as React from 'react';
import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';
import {
  Tree,
  isBranch,
  type TreeHandle,
  type TreeNode,
  type TreeSelectable,
} from '@/components/tree';
import { TreeSearchField, expandedPathTo, findTreeNode } from '../tree/combobox-tree';

// ComboboxTreeMulti — тот же рецепт, что у одиночного варианта `tree`, и по той же причине
// без cmdk (см. шапку `../tree/combobox-tree.tsx`: фильтр cmdk размонтирует несовпавшие строки
// вместе с их детьми, физически переставляет узлы и не видит виртуализированных строк).
//
// Три поведенческих отличия от одиночного варианта, и все три те же, что у `ComboboxMulti`:
// выбор НЕ закрывает popover, поиск НЕ сбрасывается между выборами, `onBlur` эмитится только
// при закрытии. Отличие от `ComboboxMulti` одно: членство переключается щелчком по строке,
// а не чекбоксом — у строки дерева уже два значка слева (треугольник и тип узла), и третий
// сделал бы уровень нечитаемым. Отметка поэтому справа, галочкой, и подкреплена заливкой строки.

/** Сколько чипов показать в триггере, прежде чем схлопнуть их в сводку «Выбрано: N». */
const DEFAULT_SUMMARY_THRESHOLD = 3;

/** Сколько строк дерева показать в поповере до появления прокрутки. */
const DEFAULT_MAX_ROWS = 12;

/** Props компонента {@link ComboboxTreeMulti}. */
export interface ComboboxTreeMultiProps {
  className?: string;
  /**
   * Выбранные узлы (`node.id`). Приходит массивом всегда: `multiValueAdapter` разворачивает
   * `null` в `[]`, потому что рендер ходит по значению `.includes`/`.map`.
   */
  value?: string[];
  /** Изменение выбора. Всегда получает НОВЫЙ массив — см. `multiValueAdapter`. */
  onChange?: (value: string[]) => void;
  /** Срабатывает при закрытии popover (снятие фокуса). */
  onBlur?: () => void;
  /** Узлы верхнего уровня. Не задан вместе с `loadChildren`. */
  nodes?: readonly TreeNode[];
  /** Ленивое чтение уровня при первом раскрытии ветки; `null` — верхний уровень. */
  loadChildren?: (node: TreeNode | null) => Promise<readonly TreeNode[]>;
  /** Ветки, раскрытые при открытии списка. Пути до выбранных узлов раскрываются и без него. */
  defaultExpandedIds?: readonly string[];
  /**
   * Что можно выбрать. По умолчанию `'leaf'` — выбор файлов: щелчок по каталогу его раскрывает.
   */
  selectable?: TreeSelectable;
  /** Подсказка в триггере, пока ничего не выбрано. По умолчанию `'Выберите файлы...'`. */
  placeholder?: string;
  /** Подсказка в поле поиска. По умолчанию `'Поиск...'`. */
  searchPlaceholder?: string;
  /** Текст пустого состояния. По умолчанию `'Ничего не найдено'`. */
  emptyText?: string;
  /** Показывать крестик сброса ВСЕГО выбора справа от триггера. */
  clearable?: boolean;
  /**
   * Потолок числа выбранных: по достижении невыбранные строки гаснут.
   * Подсказка интерфейса, а НЕ правило формы — ограничение задавайте валидатором `maxLength(n)`.
   */
  maxItems?: number;
  /** Сколько чипов показать в триггере до схлопывания в сводку. По умолчанию 3. */
  summaryThreshold?: number;
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
 * Императивный handle {@link ComboboxTreeMulti}: baseline {@link FieldHandle} на кнопке-триггере
 * + управление popover'ом и уровнями дерева.
 */
export interface ComboboxTreeMultiHandle extends FieldHandle {
  /** Открыть popover с деревом. */
  open(): void;
  /** Закрыть popover (эмитит `onBlur`, как обычное закрытие). */
  close(): void;
  /** Сбросить весь выбор. */
  clear(): void;
  /** Перечитать уровень дерева. Действует, только пока popover открыт. */
  refresh(id?: string | null): Promise<void>;
}

/**
 * Combobox с деревом, множественный выбор (вариант `tree-multi`): набор узлов — как правило
 * файлов — из иерархии. Значение — `string[] | null` на стороне формы (пустой выбор всегда
 * `null`, никогда `[]`) и `string[]` на стороне компонента.
 */
const ComboboxTreeMulti = React.forwardRef<ComboboxTreeMultiHandle, ComboboxTreeMultiProps>(
  function ComboboxTreeMulti(
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
      maxItems,
      summaryThreshold = DEFAULT_SUMMARY_THRESHOLD,
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

    const selected = React.useMemo(() => value ?? [], [value]);

    React.useImperativeHandle(
      ref,
      () => ({
        ...makeElementFieldHandle(triggerRef),
        open: () => setOpen(true),
        close: () => setOpen(false),
        clear: () => onChange?.([]),
        refresh: async (nodeId?: string | null) => {
          await treeRef.current?.refresh(nodeId);
        },
      }),
      [onChange]
    );

    // Узел мог прийти из лениво прочитанного уровня — тогда подписи у нас нет, и чип
    // показывает адрес. Для файлов это и нужно видеть: путь однозначен, имя файла — нет.
    const labelOf = React.useCallback(
      (nodeId: string) => findTreeNode(nodes, nodeId)?.label ?? nodeId,
      [nodes]
    );

    const expanded = React.useMemo(
      () => [
        ...new Set([
          ...(defaultExpandedIds ?? []),
          ...selected.flatMap((nodeId) => expandedPathTo(nodes, nodeId)),
        ]),
      ],
      [defaultExpandedIds, nodes, selected]
    );

    const atLimit = maxItems !== undefined && selected.length >= maxItems;
    /**
     * Потолок гасит только те строки, которые ещё можно было бы выбрать: уже выбранные
     * остаются живыми (иначе снять лишнее стало бы нечем), а каталоги в режиме выбора файлов
     * не гаснут вовсе — они не выбираются, и гасить их значило бы запереть навигацию.
     */
    const isNodeDisabled = React.useCallback(
      (node: TreeNode) =>
        atLimit && !selected.includes(node.id) && (selectable === 'all' || !isBranch(node)),
      [atLimit, selected, selectable]
    );

    const handleOpenChange = (next: boolean): void => {
      setOpen(next);
      if (!next) {
        setSearch('');
        onBlur?.();
      }
    };

    const handleClear = (event: React.MouseEvent): void => {
      event.stopPropagation();
      onChange?.([]);
    };

    const showClearButton = clearable && selected.length > 0 && !disabled;
    const collapsed = selected.length > summaryThreshold;

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
              aria-invalid={ariaInvalid}
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              aria-errormessage={ariaErrorMessage}
              aria-required={ariaRequired}
              className={cn(
                'h-auto min-h-9 w-full justify-between font-normal',
                showClearButton && 'pr-14',
                className
              )}
            >
              {selected.length === 0 ? (
                <span className="truncate text-muted-foreground">
                  {placeholder ?? 'Выберите файлы...'}
                </span>
              ) : collapsed ? (
                <span className="truncate" data-slot="combobox-tree-multi-summary">
                  Выбрано: {selected.length}
                </span>
              ) : (
                // Чипы неинтерактивны намеренно: интерактивный элемент внутри `button` —
                // невалидная разметка. Снять значение можно строкой дерева, сбросить всё —
                // крестиком `clearable`, который живёт ВНЕ триггера.
                <span className="flex flex-wrap gap-1" data-slot="combobox-tree-multi-chips">
                  {selected.map((nodeId) => (
                    <Badge key={nodeId} variant="secondary" data-slot="combobox-tree-multi-chip">
                      {labelOf(nodeId)}
                    </Badge>
                  ))}
                </span>
              )}
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
            <Tree
              ref={treeRef}
              nodes={nodes}
              loadChildren={loadChildren}
              defaultExpandedIds={expanded}
              selectionMode="multiple"
              // Идиом выбора из списка: щелчок и пробел переключают членство, `Escape`
              // уходит наверх и закрывает поповер, а не снимает набор.
              checkOn="click"
              checkedIds={selected}
              onCheckedChange={onChange}
              selectable={selectable}
              isNodeDisabled={maxItems === undefined ? undefined : isNodeDisabled}
              search={search}
              maxRows={maxRows}
              emptyText={emptyText ?? 'Ничего не найдено'}
              data-testid={dataTestId === undefined ? undefined : `${dataTestId}-tree`}
              aria-labelledby={ariaLabelledBy}
              renderActions={(_node, state) =>
                state.checked ? (
                  <CheckIcon
                    aria-hidden="true"
                    data-slot="combobox-tree-multi-check"
                    className="size-3.5"
                  />
                ) : null
              }
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
  }
);
ComboboxTreeMulti.displayName = 'ComboboxTreeMulti';

export { ComboboxTreeMulti };
