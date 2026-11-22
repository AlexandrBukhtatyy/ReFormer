// base — ReFormer-специфичный рецепт поверх Item/ItemGroup/ScrollArea: плотное дерево
// с уровнями, ленивым чтением уровней и виртуальным скроллом (файловый навигатор редактора).
// Отдельного shadcn-примитива нет; собран по дереву ресурсов reformer-builder.
export { Tree, TREE_ROW_HEIGHT, TREE_ROW_ATTRIBUTE } from './variants/base/tree-base';
export type {
  TreeProps,
  TreeHandle,
  TreeSelectable,
  TreeSelectionMode,
  TreeActivateMeta,
  TreeRenderState,
} from './variants/base/tree-base';

// Данные дерева. `TreeNode` — контракт узла, `TreeRow` — строка видимого ряда (её видят
// рендер-слоты и `TreeHandle.getRows`).
export type {
  TreeNode,
  TreeRow,
  TreeNodeKind,
  TreeBadgeTone,
  TreeIconRenderer,
} from './variants/base/tree-model';

// Правила выбора, пригодные и снаружи: потребитель со своим хранилищем считает ими цель
// действия и диапазон, не повторяя их у себя.
export { actionTargets, rangeIds, isBranch } from './variants/base/tree-model';

// Виртуальный скролл для рядов ФИКСИРОВАННОЙ высоты. Публичен потому, что дерево — не
// единственный такой ряд: вкладки и списки строк в редакторе живут по тем же правилам.
export { useVirtualRows, rowRange } from './variants/base/use-virtual-rows';
export type { VirtualRows, RowRange } from './variants/base/use-virtual-rows';

// props-схема варианта.
export { treeBasePropsSchema } from './variants/base/tree-base.props';
