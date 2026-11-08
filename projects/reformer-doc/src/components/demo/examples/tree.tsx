import { useState } from 'react';
import type { ReactNode } from 'react';
import { FileCode2, FileJson, FileText, Image as ImageIcon } from 'lucide-react';
import { Button, Input, Tree } from '@reformer/ui-kit';
import type { TreeNode } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Tree — не поле формы: у него нет `value` / `onChange`, поэтому каждое демо — обычный компонент
 * со своим `useState`. Variants — источники узлов и выбор, Examples — поиск и слоты строки,
 * API — таблица props.
 *
 * Страницы документации отрисовываются на сервере, поэтому виртуальный скролл выключен
 * (`virtualized={false}`) везде, кроме примера с `maxRows`: там высота определена, и окно строк
 * считается от неё. Рамка с границей (TreeFrame) и подпись под деревом (Caption) — оформление демо,
 * в `code` их нет: дерево само ни фона, ни границы не рисует.
 */

/** Дерево файлов проекта — общий источник для демо. */
const PROJECT_TREE: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    kind: 'branch',
    children: [
      {
        id: 'src/components',
        label: 'components',
        kind: 'branch',
        children: [
          { id: 'src/components/tree.tsx', label: 'tree.tsx' },
          { id: 'src/components/button.tsx', label: 'button.tsx' },
        ],
      },
      { id: 'src/index.ts', label: 'index.ts' },
      { id: 'src/logo.svg', label: 'logo.svg' },
    ],
  },
  {
    id: 'docs',
    label: 'docs',
    kind: 'branch',
    children: [{ id: 'docs/overview.md', label: 'overview.md' }],
  },
  { id: 'package.json', label: 'package.json' },
];

const PROJECT_TREE_CODE = `const PROJECT_TREE: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    kind: 'branch',
    children: [
      {
        id: 'src/components',
        label: 'components',
        kind: 'branch',
        children: [
          { id: 'src/components/tree.tsx', label: 'tree.tsx' },
          { id: 'src/components/button.tsx', label: 'button.tsx' },
        ],
      },
      { id: 'src/index.ts', label: 'index.ts' },
      { id: 'src/logo.svg', label: 'logo.svg' },
    ],
  },
  {
    id: 'docs',
    label: 'docs',
    kind: 'branch',
    children: [{ id: 'docs/overview.md', label: 'overview.md' }],
  },
  { id: 'package.json', label: 'package.json' },
];`;

/** Те же файлы с метками — состояние рабочей копии, каким его показывает редактор. */
const REVIEW_TREE: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    kind: 'branch',
    badge: '3',
    badgeTone: 'secondary',
    children: [
      { id: 'src/tree.tsx', label: 'tree.tsx', badge: 'M' },
      { id: 'src/tree.test.tsx', label: 'tree.test.tsx', badge: 'A', badgeTone: 'secondary' },
      { id: 'src/legacy.tsx', label: 'legacy.tsx', badge: 'D', badgeTone: 'destructive' },
    ],
  },
  { id: 'notes.md', label: 'notes.md', badge: '?', badgeTone: 'outline' },
];

/** Уровни ленивого источника: ключ — адрес ветки, пустая строка — верхний уровень. */
const LEVELS: Record<string, TreeNode[]> = {
  '': [
    { id: 'app', label: 'app', kind: 'branch' },
    { id: 'secrets', label: 'secrets', kind: 'branch' },
    { id: 'CHANGELOG.md', label: 'CHANGELOG.md' },
  ],
  app: [
    { id: 'app/main.ts', label: 'main.ts' },
    { id: 'app/pages', label: 'pages', kind: 'branch' },
  ],
  'app/pages': [{ id: 'app/pages/home.tsx', label: 'home.tsx' }],
};

// Вместо запроса к серверу — задержка 600 мс; каталог secrets всегда отвечает отказом.
function loadLevel(node: TreeNode | null): Promise<readonly TreeNode[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (node?.id === 'secrets') reject(new Error('403: нет прав на каталог'));
      else resolve(LEVELS[node?.id ?? ''] ?? []);
    }, 600);
  });
}

/** Рамка превью: дерево само ни фона, ни границы не рисует. */
function TreeFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <div className="rounded-md border">{children}</div>
    </div>
  );
}

/** Подпись под превью — что дерево считает выбранным прямо сейчас. */
function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs text-muted-foreground">{children}</p>;
}

/* ─── Variants ────────────────────────────────────────────────────────────── */

function StaticTreeVariant() {
  return (
    <TreeFrame>
      <Tree
        nodes={PROJECT_TREE}
        defaultExpandedIds={['src', 'src/components']}
        virtualized={false}
        aria-label="Файлы проекта"
      />
    </TreeFrame>
  );
}

function LazyTreeVariant() {
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <TreeFrame>
      <Tree
        loadChildren={loadLevel}
        onLoadError={(error, node) => setFailure(`${node?.label}: ${String(error)}`)}
        virtualized={false}
        aria-label="Файлы на сервере"
      />
      <Caption>{failure ?? 'Раскройте app и secrets.'}</Caption>
    </TreeFrame>
  );
}

function SelectedTreeVariant() {
  const [selectedId, setSelectedId] = useState<string | null>('src/components/tree.tsx');
  return (
    <TreeFrame>
      <Tree
        nodes={PROJECT_TREE}
        defaultExpandedIds={['src', 'src/components']}
        selectedId={selectedId}
        onSelectedChange={setSelectedId}
        virtualized={false}
        aria-label="Файлы проекта"
      />
      <Caption>Выделено: {selectedId ?? '—'}</Caption>
    </TreeFrame>
  );
}

function MultipleTreeVariant() {
  const [checkedIds, setCheckedIds] = useState<string[]>(['src/index.ts']);
  return (
    <TreeFrame>
      <Tree
        nodes={PROJECT_TREE}
        defaultExpandedIds={['src']}
        selectionMode="multiple"
        checkOn="click"
        checkedIds={checkedIds}
        onCheckedChange={setCheckedIds}
        virtualized={false}
        aria-label="Файлы для отправки"
      />
      <Caption>Отмечено: {checkedIds.length === 0 ? '—' : checkedIds.join(', ')}</Caption>
    </TreeFrame>
  );
}

/* ─── Examples ────────────────────────────────────────────────────────────── */

function SearchTreeExample() {
  const [search, setSearch] = useState('');
  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <div className="space-y-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по подписи"
          aria-label="Поиск по дереву"
        />
        <Tree
          nodes={PROJECT_TREE}
          search={search}
          defaultExpandedIds={['src', 'src/components']}
          maxRows={5}
          emptyText="Ничего не найдено"
          aria-label="Файлы проекта"
        />
      </div>
    </div>
  );
}

/** Значок по расширению: возврат `null` оставляет умолчание (каталог / файл). */
function fileIcon(node: TreeNode, state: { readonly branch: boolean }): ReactNode {
  if (state.branch) return null;
  if (node.label.endsWith('.ts') || node.label.endsWith('.tsx')) {
    return <FileCode2 aria-hidden="true" className="size-3.5 opacity-70" />;
  }
  if (node.label.endsWith('.json')) {
    return <FileJson aria-hidden="true" className="size-3.5 opacity-70" />;
  }
  if (node.label.endsWith('.svg')) {
    return <ImageIcon aria-hidden="true" className="size-3.5 opacity-70" />;
  }
  return <FileText aria-hidden="true" className="size-3.5 opacity-70" />;
}

function IconsTreeExample() {
  return (
    <TreeFrame>
      <Tree
        nodes={PROJECT_TREE}
        defaultExpandedIds={['src', 'src/components', 'docs']}
        renderIcon={fileIcon}
        virtualized={false}
        aria-label="Файлы проекта"
      />
    </TreeFrame>
  );
}

function BadgesTreeExample() {
  return (
    <TreeFrame>
      <Tree
        nodes={REVIEW_TREE}
        defaultExpandedIds={['src']}
        virtualized={false}
        aria-label="Изменения рабочей копии"
      />
    </TreeFrame>
  );
}

function ActionsTreeExample() {
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <TreeFrame>
      <Tree
        nodes={PROJECT_TREE}
        defaultExpandedIds={['src']}
        renderActions={(node, state) =>
          state.branch ? null : (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 px-1.5 text-[10px]"
              onClick={(event) => {
                // Иначе щелчок дойдёт до строки и выделит её: одно нажатие — одно действие.
                event.stopPropagation();
                setOpened(node.id);
              }}
            >
              Открыть
            </Button>
          )
        }
        virtualized={false}
        aria-label="Файлы проекта"
      />
      <Caption>Открыт: {opened ?? '—'}</Caption>
    </TreeFrame>
  );
}

function EmptyTreeExample() {
  return (
    <TreeFrame>
      <Tree nodes={[]} emptyText="Каталог пуст" virtualized={false} aria-label="Пустой каталог" />
    </TreeFrame>
  );
}

export const treeDocConfig: ComponentDocConfig = {
  name: 'Tree',
  importFrom: '@reformer/ui-kit',
  description:
    'Плотное дерево строк файлового навигатора: уровни, треугольники, значки, метки. Навигация, а не поле формы.',
  variants: [
    {
      id: 'static',
      title: 'Готовые узлы (nodes)',
      description:
        'Дерево известно заранее. id — полный путь, уникальный во всём дереве; kind="branch" у каталогов объявлен явно. Стартовое раскрытие — defaultExpandedIds.',
      render: StaticTreeVariant,
      code: `${PROJECT_TREE_CODE}

<Tree
  nodes={PROJECT_TREE}
  defaultExpandedIds={['src', 'src/components']}
  virtualized={false}
  aria-label="Файлы проекта"
/>`,
    },
    {
      id: 'lazy',
      title: 'Ленивое чтение уровней (loadChildren)',
      description:
        'nodes не заданы — верхний уровень дерево читает само, передав в загрузчик null. Пока уровень читается, вместо треугольника крутится спиннер; отказ красит подпись ветки и уходит в onLoadError.',
      render: LazyTreeVariant,
      code: `const LEVELS: Record<string, TreeNode[]> = {
  '': [
    { id: 'app', label: 'app', kind: 'branch' },
    { id: 'secrets', label: 'secrets', kind: 'branch' },
    { id: 'CHANGELOG.md', label: 'CHANGELOG.md' },
  ],
  app: [
    { id: 'app/main.ts', label: 'main.ts' },
    { id: 'app/pages', label: 'pages', kind: 'branch' },
  ],
  'app/pages': [{ id: 'app/pages/home.tsx', label: 'home.tsx' }],
};

// Вместо запроса к серверу — задержка 600 мс; каталог secrets всегда отвечает отказом.
function loadLevel(node: TreeNode | null): Promise<readonly TreeNode[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (node?.id === 'secrets') reject(new Error('403: нет прав на каталог'));
      else resolve(LEVELS[node?.id ?? ''] ?? []);
    }, 600);
  });
}

const [failure, setFailure] = useState<string | null>(null);

<Tree
  loadChildren={loadLevel}
  onLoadError={(error, node) => setFailure(\`\${node?.label}: \${String(error)}\`)}
  virtualized={false}
  aria-label="Файлы на сервере"
/>`,
    },
    {
      id: 'selected',
      title: 'Выделение (selectedId)',
      description:
        'Выделение — «где я сейчас», ровно одна строка, на ней же фокус. Здесь оно управляемое, раскрытие оставлено дереву.',
      render: SelectedTreeVariant,
      code: `// PROJECT_TREE — из варианта «Готовые узлы»
const [selectedId, setSelectedId] = useState<string | null>('src/components/tree.tsx');

<Tree
  nodes={PROJECT_TREE}
  defaultExpandedIds={['src', 'src/components']}
  selectedId={selectedId}
  onSelectedChange={setSelectedId}
  virtualized={false}
  aria-label="Файлы проекта"
/>`,
    },
    {
      id: 'multiple',
      title: 'Отмеченный набор (selectionMode="multiple")',
      description:
        'Набор — «что я выбрал», отдельно от выделения. checkOn="click": щелчок и пробел переключают строку. По умолчанию checkOn="modifier": щелчок заменяет набор, Ctrl/Cmd добавляет, Shift — диапазон.',
      render: MultipleTreeVariant,
      code: `// PROJECT_TREE — из варианта «Готовые узлы»
const [checkedIds, setCheckedIds] = useState<string[]>(['src/index.ts']);

<Tree
  nodes={PROJECT_TREE}
  defaultExpandedIds={['src']}
  selectionMode="multiple"
  checkOn="click"
  checkedIds={checkedIds}
  onCheckedChange={setCheckedIds}
  virtualized={false}
  aria-label="Файлы для отправки"
/>`,
    },
  ],
  examples: [
    {
      id: 'search',
      title: 'Поиск по подписи (search)',
      description:
        'Остаются узлы, в подписи которых есть подстрока, и путь до них; ветки на пути раскрываются на время поиска. Поиск видит только прочитанные уровни. maxRows задаёт высоту — остальные строки прокручиваются.',
      render: SearchTreeExample,
      code: `// PROJECT_TREE — из варианта «Готовые узлы»
const [search, setSearch] = useState('');

<div className="space-y-2">
  <Input
    value={search}
    onChange={(event) => setSearch(event.target.value)}
    placeholder="Поиск по подписи"
    aria-label="Поиск по дереву"
  />
  <Tree
    nodes={PROJECT_TREE}
    search={search}
    defaultExpandedIds={['src', 'src/components']}
    maxRows={5}
    emptyText="Ничего не найдено"
    aria-label="Файлы проекта"
  />
</div>`,
    },
    {
      id: 'icons',
      title: 'Свои значки (renderIcon)',
      description:
        'renderIcon получает узел и состояние строки; null оставляет значок по умолчанию — папку или файл. Значок — 14 px (size-3.5): больше строка высотой 24 px не примет.',
      render: IconsTreeExample,
      code: `// PROJECT_TREE — из варианта «Готовые узлы»
function fileIcon(node: TreeNode, state: { readonly branch: boolean }): ReactNode {
  if (state.branch) return null;
  if (node.label.endsWith('.ts') || node.label.endsWith('.tsx')) {
    return <FileCode2 aria-hidden="true" className="size-3.5 opacity-70" />;
  }
  if (node.label.endsWith('.json')) {
    return <FileJson aria-hidden="true" className="size-3.5 opacity-70" />;
  }
  if (node.label.endsWith('.svg')) {
    return <ImageIcon aria-hidden="true" className="size-3.5 opacity-70" />;
  }
  return <FileText aria-hidden="true" className="size-3.5 opacity-70" />;
}

<Tree
  nodes={PROJECT_TREE}
  defaultExpandedIds={['src', 'src/components', 'docs']}
  renderIcon={fileIcon}
  virtualized={false}
  aria-label="Файлы проекта"
/>`,
    },
    {
      id: 'badges',
      title: 'Метки узлов (badge)',
      description:
        'badge и badgeTone задаются в данных узла, а не слотом. Тоны — как у Badge: default, secondary, destructive, outline.',
      render: BadgesTreeExample,
      code: `const REVIEW_TREE: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    kind: 'branch',
    badge: '3',
    badgeTone: 'secondary',
    children: [
      { id: 'src/tree.tsx', label: 'tree.tsx', badge: 'M' },
      { id: 'src/tree.test.tsx', label: 'tree.test.tsx', badge: 'A', badgeTone: 'secondary' },
      { id: 'src/legacy.tsx', label: 'legacy.tsx', badge: 'D', badgeTone: 'destructive' },
    ],
  },
  { id: 'notes.md', label: 'notes.md', badge: '?', badgeTone: 'outline' },
];

<Tree
  nodes={REVIEW_TREE}
  defaultExpandedIds={['src']}
  virtualized={false}
  aria-label="Изменения рабочей копии"
/>`,
    },
    {
      id: 'actions',
      title: 'Правый край строки (renderActions)',
      description:
        'renderActions рисует кнопки и метки справа. Обработчик гасит всплытие: иначе щелчок по кнопке ещё и выделит строку.',
      render: ActionsTreeExample,
      code: `// PROJECT_TREE — из варианта «Готовые узлы»
const [opened, setOpened] = useState<string | null>(null);

<Tree
  nodes={PROJECT_TREE}
  defaultExpandedIds={['src']}
  renderActions={(node, state) =>
    state.branch ? null : (
      <Button
        variant="ghost"
        size="sm"
        className="h-4 px-1.5 text-[10px]"
        onClick={(event) => {
          // Иначе щелчок дойдёт до строки и выделит её: одно нажатие — одно действие.
          event.stopPropagation();
          setOpened(node.id);
        }}
      >
        Открыть
      </Button>
    )
  }
  virtualized={false}
  aria-label="Файлы проекта"
/>`,
    },
    {
      id: 'empty',
      title: 'Пустое дерево (emptyText)',
      description:
        'Нет узлов или поиск ничего не нашёл — дерево показывает одну строку emptyText. По умолчанию — строка словаря kit.tree.empty («Пусто»).',
      render: EmptyTreeExample,
      code: `<Tree nodes={[]} emptyText="Каталог пуст" virtualized={false} aria-label="Пустой каталог" />`,
    },
  ],
  props: [
    {
      name: 'nodes',
      type: 'readonly TreeNode[]',
      description:
        'Узлы верхнего уровня. Ветки без children дочитываются через loadChildren, если он задан.',
    },
    {
      name: 'loadChildren',
      type: '(node: TreeNode | null) => Promise<readonly TreeNode[]>',
      description:
        'Чтение уровня при первом раскрытии ветки; null — верхний уровень (если nodes не заданы). Прочитанный уровень запоминается.',
    },
    {
      name: 'expandedIds',
      type: 'readonly string[]',
      description: 'Раскрытые ветки, когда раскрытием управляете вы.',
    },
    {
      name: 'defaultExpandedIds',
      type: 'readonly string[]',
      description: 'Ветки, раскрытые на старте, если раскрытием управляет дерево.',
    },
    {
      name: 'onExpandedChange',
      type: '(ids: string[]) => void',
      description: 'Смена раскрытых веток.',
    },
    {
      name: 'selectedId',
      type: 'string | null',
      description: 'Выделенная строка, когда выделением управляете вы. Одна строка, на ней фокус.',
    },
    {
      name: 'defaultSelectedId',
      type: 'string | null',
      description: 'Выделенная строка на старте.',
    },
    {
      name: 'onSelectedChange',
      type: '(id: string | null) => void',
      description: 'Смена выделения.',
    },
    {
      name: 'checkedIds',
      type: 'readonly string[]',
      description:
        'Отмеченный набор, когда им управляете вы. Только при selectionMode="multiple"; отдельно от выделения.',
    },
    {
      name: 'defaultCheckedIds',
      type: 'readonly string[]',
      description: 'Отмеченный набор на старте.',
    },
    {
      name: 'onCheckedChange',
      type: '(ids: string[]) => void',
      description: 'Смена набора.',
    },
    {
      name: 'selectionMode',
      type: "'single' | 'multiple'",
      default: "'single'",
      description: 'single — только выделение; multiple — выделение плюс отмеченный набор.',
    },
    {
      name: 'checkOn',
      type: "'modifier' | 'click'",
      default: "'modifier'",
      description:
        'modifier — как в файловом менеджере: щелчок заменяет набор, Ctrl/Cmd добавляет, Shift — диапазон. click — щелчок и пробел переключают строку.',
    },
    {
      name: 'selectable',
      type: "'all' | 'leaf'",
      default: "'all'",
      description: 'leaf — выбрать можно только лист; щелчок по ветке её раскрывает.',
    },
    {
      name: 'isNodeDisabled',
      type: '(node: TreeNode) => boolean',
      description:
        'Запрет выбора поверх node.disabled — для правил, которых нет в данных: лимит выбранных, права.',
    },
    {
      name: 'onActivate',
      type: '(node: TreeNode, meta: { preview: boolean }) => void',
      description:
        'Запуск строки. preview: true — щелчок или пробел, false — двойной щелчок или Enter.',
    },
    {
      name: 'onRowClick',
      type: '(node: TreeNode, event: React.MouseEvent) => void',
      description:
        'Щелчок до правил выбора дерева. event.preventDefault() отменяет обработку строки деревом.',
    },
    {
      name: 'onRowDoubleClick',
      type: '(node: TreeNode, event: React.MouseEvent) => void',
      description: 'Двойной щелчок до запуска строки; preventDefault() отменяет запуск.',
    },
    {
      name: 'onContextMenu',
      type: 'React.MouseEventHandler<HTMLDivElement>',
      description: 'Правый щелчок по дереву. Строку находят по атрибуту data-tree-id.',
    },
    {
      name: 'getRowProps',
      type: '(node: TreeNode, row: TreeRow) => HTMLAttributes',
      description: 'Свои атрибуты строки: data-*, title, обработчики.',
    },
    {
      name: 'search',
      type: 'string',
      description:
        'Поиск подстроки в подписи без учёта регистра. Путь до совпадения раскрывается на время поиска.',
    },
    {
      name: 'emptyText',
      type: 'string',
      default: 'kit.tree.empty',
      description: 'Текст пустого дерева. По умолчанию — строка словаря («Empty» / «Пусто»).',
    },
    {
      name: 'rowHeight',
      type: 'number',
      default: '24',
      description: 'Высота строки, px.',
    },
    {
      name: 'maxRows',
      type: 'number',
      description:
        'Сколько строк показать до прокрутки — высота по содержимому. Без него высоту задаёт className.',
    },
    { name: 'indent', type: 'number', default: '12', description: 'Отступ уровня, px.' },
    {
      name: 'indentBase',
      type: 'number',
      default: '8',
      description: 'Отступ первого уровня, px.',
    },
    {
      name: 'virtualized',
      type: 'boolean',
      default: 'true',
      description:
        'Виртуальный скролл: в разметке только видимые строки. Выключают при отрисовке на сервере.',
    },
    {
      name: 'renderIcon',
      type: '(node: TreeNode, state: TreeRenderState) => ReactNode',
      description: 'Значок строки; null оставляет папку или файл.',
    },
    {
      name: 'renderLabel',
      type: '(node: TreeNode, state: TreeRenderState) => ReactNode',
      description: 'Подпись строки; null оставляет node.label.',
    },
    {
      name: 'renderActions',
      type: '(node: TreeNode, state: TreeRenderState) => ReactNode',
      description: 'Содержимое правого края строки.',
    },
    {
      name: 'onLoadError',
      type: '(error: unknown, node: TreeNode | null) => void',
      description: 'Отказ чтения уровня. По умолчанию — сообщение в консоль.',
    },
    {
      name: 'ref',
      type: 'Ref<TreeHandle>',
      description:
        'expand, collapse, toggle, refresh(id), focusNode(id), getRows(), getActionTargets() и focus/blur.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Классы контейнера дерева, например h-full.',
    },
    {
      name: 'id / aria-label / aria-labelledby / aria-describedby',
      type: 'string',
      description: 'Атрибуты элемента role="tree": подпись дерева для скринридера.',
    },
    {
      name: 'data-testid',
      type: 'string',
      description:
        'Префикс: на корне как есть, на строке — «-<id узла>», на треугольнике — «-<id узла>-chevron».',
    },
  ],
};
