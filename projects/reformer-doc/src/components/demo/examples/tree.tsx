import { useState } from 'react';
import type { ReactNode } from 'react';
import { FileCode2, FileJson, FileText, Image as ImageIcon } from 'lucide-react';
import { Button, Input, Tree } from '@reformer/ui-kit';
import type { TreeNode } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Tree — НЕ form-control: у него нет ни `value`, ни `onChange`, ни `TreeField`, поэтому
 * `makeFieldVariant` здесь не годится и каждое демо — обычный компонент со своим `useState`.
 * Дерево отвечает на вопрос «где я и что вокруг», а поле формы обязано отдавать одно
 * значение; выбор файла формой делает вариант комбобокса (`ComboboxTree`), который это же
 * дерево держит внутри поповера.
 *
 * Страницы документации отрисовываются на сервере и живут в узких карточках превью, поэтому
 * там, где важна вся разметка, виртуальный скролл выключен (`virtualized={false}`), а там,
 * где он показывается, дереву задана определённая высота (`maxRows`) — без неё измерять
 * вьюпорт не на чем.
 */

/** Дерево файлов проекта: статический источник для большинства демо. */
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
          { id: 'src/components/combobox.tsx', label: 'combobox.tsx' },
          { id: 'src/components/button.tsx', label: 'button.tsx' },
        ],
      },
      {
        id: 'src/assets',
        label: 'assets',
        kind: 'branch',
        children: [
          { id: 'src/assets/logo.svg', label: 'logo.svg' },
          { id: 'src/assets/cover.png', label: 'cover.png' },
        ],
      },
      { id: 'src/index.ts', label: 'index.ts' },
      { id: 'src/theme.css', label: 'theme.css' },
    ],
  },
  {
    id: 'docs',
    label: 'docs',
    kind: 'branch',
    children: [
      { id: 'docs/overview.md', label: 'overview.md' },
      { id: 'docs/tree.md', label: 'tree.md' },
    ],
  },
  { id: 'package.json', label: 'package.json' },
  { id: 'README.md', label: 'README.md' },
];

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
  { id: 'package.json', label: 'package.json' },
  { id: 'notes.md', label: 'notes.md', badge: '?', badgeTone: 'outline' },
];

/** Уровни ленивого источника: ключ — адрес ветки, пустая строка — верхний уровень. */
const LAZY_LEVELS: Record<string, TreeNode[]> = {
  '': [
    { id: 'app', label: 'app', kind: 'branch' },
    { id: 'lib', label: 'lib', kind: 'branch' },
    { id: 'secrets', label: 'secrets', kind: 'branch' },
    { id: 'CHANGELOG.md', label: 'CHANGELOG.md' },
  ],
  app: [
    { id: 'app/main.ts', label: 'main.ts' },
    { id: 'app/router.ts', label: 'router.ts' },
    { id: 'app/pages', label: 'pages', kind: 'branch' },
  ],
  'app/pages': [
    { id: 'app/pages/home.tsx', label: 'home.tsx' },
    { id: 'app/pages/login.tsx', label: 'login.tsx' },
  ],
  lib: [
    { id: 'lib/http.ts', label: 'http.ts' },
    { id: 'lib/format.ts', label: 'format.ts' },
  ],
};

/**
 * Детерминированный mock источника: уровень читается 600 мс, каталог `secrets` всегда
 * отвечает отказом — так на превью видно и спиннер вместо треугольника, и тревожную
 * подпись непрочитанной ветки.
 */
function loadLazyLevel(node: TreeNode | null): Promise<readonly TreeNode[]> {
  const key = node?.id ?? '';
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (key === 'secrets') {
        reject(new Error('403: нет прав на каталог'));
        return;
      }
      resolve(LAZY_LEVELS[key] ?? []);
    }, 600);
  });
}

/** Рамка превью: дерево само ни фона, ни границы не рисует — их задаёт вызывающий. */
function TreeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="border-border rounded-md border" style={{ maxWidth: 380, width: '100%' }}>
      {children}
    </div>
  );
}

/** Подпись под превью — что дерево считает выбранным прямо сейчас. */
function Caption({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground mt-2 text-[13px]">{children}</p>;
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
    <div style={{ maxWidth: 380, width: '100%' }}>
      <TreeFrame>
        <Tree
          loadChildren={loadLazyLevel}
          virtualized={false}
          onLoadError={(error, node) => setFailure(`${node?.label ?? 'корень'}: ${String(error)}`)}
          aria-label="Ленивое дерево"
        />
      </TreeFrame>
      <Caption>{failure ?? 'Уровень читается 600 мс; каталог «secrets» отвечает отказом.'}</Caption>
    </div>
  );
}

function SelectedTreeVariant() {
  const [selectedId, setSelectedId] = useState<string | null>('src/components/tree.tsx');
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <TreeFrame>
        <Tree
          nodes={PROJECT_TREE}
          defaultExpandedIds={['src', 'src/components']}
          selectedId={selectedId}
          onSelectedChange={setSelectedId}
          virtualized={false}
          aria-label="Файлы проекта"
        />
      </TreeFrame>
      <Caption>Выделено: {selectedId ?? '—'}</Caption>
    </div>
  );
}

function MultipleTreeVariant() {
  const [checkedIds, setCheckedIds] = useState<string[]>(['src/index.ts']);
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <TreeFrame>
        <Tree
          nodes={PROJECT_TREE}
          defaultExpandedIds={['src']}
          selectionMode="multiple"
          checkOn="click"
          checkedIds={checkedIds}
          onCheckedChange={setCheckedIds}
          virtualized={false}
          aria-label="Файлы для действия"
        />
      </TreeFrame>
      <Caption>Отмечено: {checkedIds.length === 0 ? '—' : checkedIds.join(', ')}</Caption>
    </div>
  );
}

/* ─── Examples ────────────────────────────────────────────────────────────── */

function SearchTreeExample() {
  const [search, setSearch] = useState('');
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Поиск по подписи"
        aria-label="Поиск по дереву"
      />
      <div className="border-border mt-2 rounded-md border">
        <Tree
          nodes={PROJECT_TREE}
          search={search}
          defaultExpandedIds={['src', 'src/components']}
          maxRows={8}
          aria-label="Файлы проекта"
        />
      </div>
      <Caption>Высоту дерева задаёт maxRows, остальные строки прокручиваются виртуально.</Caption>
    </div>
  );
}

/** Значок по расширению: возврат `null` оставляет умолчание (каталог / файл). */
function fileIcon(node: TreeNode, state: { readonly branch: boolean }): ReactNode {
  if (state.branch) return null;
  if (node.label.endsWith('.tsx') || node.label.endsWith('.ts')) {
    return <FileCode2 aria-hidden="true" className="size-3.5 text-sky-500" />;
  }
  if (node.label.endsWith('.json')) {
    return <FileJson aria-hidden="true" className="size-3.5 text-amber-500" />;
  }
  if (node.label.endsWith('.svg') || node.label.endsWith('.png')) {
    return <ImageIcon aria-hidden="true" className="size-3.5 text-violet-500" />;
  }
  return <FileText aria-hidden="true" className="size-3.5 opacity-70" />;
}

function IconsTreeExample() {
  return (
    <TreeFrame>
      <Tree
        nodes={PROJECT_TREE}
        defaultExpandedIds={['src', 'src/components', 'src/assets']}
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
    <div style={{ maxWidth: 380, width: '100%' }}>
      <TreeFrame>
        <Tree
          nodes={PROJECT_TREE}
          defaultExpandedIds={['src']}
          virtualized={false}
          renderActions={(node, state) =>
            state.branch ? null : (
              <Button
                variant="ghost"
                className="h-4 px-1.5 text-[10px]"
                onClick={(event) => {
                  // Строка под кнопкой своё правило выбора применять не должна: одно
                  // нажатие — одно действие.
                  event.stopPropagation();
                  setOpened(node.id);
                }}
              >
                Открыть
              </Button>
            )
          }
          aria-label="Файлы проекта"
        />
      </TreeFrame>
      <Caption>Последнее действие: {opened ?? '—'}</Caption>
    </div>
  );
}

function EmptyTreeExample() {
  return (
    <TreeFrame>
      <Tree nodes={[]} emptyText="Каталог пуст" virtualized={false} aria-label="Пустое дерево" />
    </TreeFrame>
  );
}

export const treeDocConfig: ComponentDocConfig = {
  name: 'Tree',
  importFrom: '@reformer/ui-kit',
  description:
    'Плотное дерево строк файлового навигатора: уровни, треугольники, значки, метки. Источник — либо готовые узлы (nodes), либо ленивое чтение уровня (loadChildren); раскрытие, выделение и отмеченный набор дерево держит само, но у каждой оси есть управляемая пара. Виртуальный скролл включён по умолчанию. Tree — навигация, а не поле формы: у него нет value / onChange и нет TreeField.',
  variants: [
    {
      id: 'static',
      title: 'Готовые узлы (nodes)',
      description:
        'Всё дерево известно заранее: узлы приходят пропом, стартовое раскрытие задаёт defaultExpandedIds. kind объявляется, а не выводится из children: пустой каталог иначе был бы неотличим от файла.',
      render: StaticTreeVariant,
      code: `const NODES: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    kind: 'branch',
    children: [{ id: 'src/index.ts', label: 'index.ts' }],
  },
  { id: 'package.json', label: 'package.json' },
];

<Tree nodes={NODES} defaultExpandedIds={['src']} virtualized={false} />`,
    },
    {
      id: 'lazy',
      title: 'Ленивое чтение уровней (loadChildren)',
      description:
        'nodes не заданы — верхний уровень дерево читает само, передав в загрузчик null. Пока уровень читается, вместо треугольника крутится спиннер; отказ делает подпись ветки тревожной и уходит в onLoadError. Прочитанный уровень запоминается: свернуть и раскрыть обратно обращения не стоит.',
      render: LazyTreeVariant,
      code: `<Tree
  loadChildren={(node) => fetchLevel(node?.id ?? null)}
  onLoadError={(error, node) => toast(String(error))}
/>`,
    },
    {
      id: 'expanded-selected',
      title: 'Предраскрытые ветки и выделение',
      description:
        'Выделение — «где я сейчас», ровно одна строка: здесь оно управляемо (selectedId / onSelectedChange), а стартовое раскрытие оставлено дереву (defaultExpandedIds).',
      render: SelectedTreeVariant,
      code: `const [selectedId, setSelectedId] = useState<string | null>('src/index.ts');

<Tree
  nodes={NODES}
  defaultExpandedIds={['src', 'src/components']}
  selectedId={selectedId}
  onSelectedChange={setSelectedId}
/>`,
    },
    {
      id: 'multiple',
      title: 'Отмеченный набор (selectionMode="multiple")',
      description:
        'Набор — «что я выбрал», ось отдельная от выделения. checkOn="click" даёт идиом списка: щелчок и пробел переключают членство строки. Умолчание checkOn="modifier" — идиом навигатора файлов: щелчок заменяет набор, Ctrl/Cmd пополняет по одной, Shift берёт диапазон.',
      render: MultipleTreeVariant,
      code: `const [checkedIds, setCheckedIds] = useState<string[]>([]);

<Tree
  nodes={NODES}
  selectionMode="multiple"
  checkOn="click"
  checkedIds={checkedIds}
  onCheckedChange={setCheckedIds}
/>`,
    },
  ],
  examples: [
    {
      id: 'search',
      title: 'Поиск по подписи (search)',
      description:
        'Запрос оставляет узлы, чей label содержит подстроку, и достраивает до них путь; ветки на пути раскрываются на время поиска и возвращаются в прежнее состояние, когда запрос убран. Фильтр видит только ПРОЧИТАННЫЕ уровни — у ленивого источника поиск за уровнями не ходит. maxRows задаёт дереву определённую высоту, на которой и работает виртуальный скролл.',
      render: SearchTreeExample,
      code: `const [search, setSearch] = useState('');

<Input value={search} onChange={(e) => setSearch(e.target.value)} />
<Tree nodes={NODES} search={search} maxRows={8} />`,
    },
    {
      id: 'icons',
      title: 'Свои значки (renderIcon)',
      description:
        'renderIcon получает узел и состояние строки ({ branch, expanded }); возврат null оставляет умолчание — папку у ветки и лист у файла. Размер значка держим 3.5 (14 px): строка высотой 24 px больше не примет.',
      render: IconsTreeExample,
      code: `<Tree
  nodes={NODES}
  renderIcon={(node, { branch }) =>
    branch ? null : <FileCode2 className="size-3.5 text-sky-500" />
  }
/>`,
    },
    {
      id: 'badges',
      title: 'Метки узлов (badge)',
      description:
        'badge и badgeTone объявляются НА УЗЛЕ, а не рисуются слотом: метка — свойство данных (состояние файла в рабочей копии, число непрочитанных), и дереву не приходится звать потребителя ради каждой строки. Тона — те же, что у Badge.',
      render: BadgesTreeExample,
      code: `const NODES: TreeNode[] = [
  { id: 'src/tree.tsx', label: 'tree.tsx', badge: 'M' },
  { id: 'src/legacy.tsx', label: 'legacy.tsx', badge: 'D', badgeTone: 'destructive' },
];

<Tree nodes={NODES} />`,
    },
    {
      id: 'actions',
      title: 'Правый край строки (renderActions)',
      description:
        'renderActions рисует содержимое правого края — кнопки, подсказки, свои метки. Обработчик обязан гасить всплытие: иначе один щелчок стал бы двумя действиями, своим и выбором строки.',
      render: ActionsTreeExample,
      code: `<Tree
  nodes={NODES}
  renderActions={(node, { branch }) =>
    branch ? null : (
      <Button
        variant="ghost"
        className="h-4 px-1.5 text-[10px]"
        onClick={(event) => {
          event.stopPropagation();
          open(node.id);
        }}
      >
        Открыть
      </Button>
    )
  }
/>`,
    },
    {
      id: 'empty',
      title: 'Пустое состояние (emptyText)',
      description:
        'Пустой ряд строк — и когда узлов нет, и когда по запросу ничего не совпало — показывается одной подписью emptyText (по умолчанию «Пусто»).',
      render: EmptyTreeExample,
      code: `<Tree nodes={[]} emptyText="Каталог пуст" />`,
    },
  ],
  props: [
    {
      name: 'nodes',
      type: 'readonly TreeNode[]',
      description:
        'Узлы верхнего уровня. Не задан вместе с loadChildren — верхний уровень дерево прочитает само.',
    },
    {
      name: 'loadChildren',
      type: '(node: TreeNode | null) => Promise<readonly TreeNode[]>',
      description:
        'Ленивое чтение уровня при первом раскрытии ветки; null — верхний уровень. Прочитанное запоминается.',
    },
    {
      name: 'expandedIds',
      type: 'readonly string[]',
      description: 'Раскрытые ветки (управляемо). Без него дерево держит раскрытие само.',
    },
    {
      name: 'defaultExpandedIds',
      type: 'readonly string[]',
      description: 'Ветки, раскрытые на старте (неуправляемо).',
    },
    {
      name: 'onExpandedChange',
      type: '(ids: string[]) => void',
      description: 'Смена раскрытых веток.',
    },
    {
      name: 'selectedId',
      type: 'string | null',
      description: 'Выделенный узел (управляемо) — «где я сейчас», ровно одна строка.',
    },
    {
      name: 'defaultSelectedId',
      type: 'string | null',
      description: 'Выделенный узел на старте (неуправляемо).',
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
        'Отмеченный набор (управляемо) — «что я выбрал». Ось отдельная от выделения: в наборе строк сколько угодно, а фокус стоит на одной, и она может в набор не входить.',
    },
    {
      name: 'defaultCheckedIds',
      type: 'readonly string[]',
      description: 'Отмеченный набор на старте (неуправляемо).',
    },
    {
      name: 'onCheckedChange',
      type: '(ids: string[]) => void',
      description: 'Смена набора; порядок — порядок строк дерева.',
    },
    {
      name: 'selectionMode',
      type: "'single' | 'multiple'",
      default: "'single'",
      description: 'Один узел (курсор) или курсор плюс отмеченный набор.',
    },
    {
      name: 'checkOn',
      type: "'modifier' | 'click'",
      default: "'modifier'",
      description:
        'Как строка попадает в набор: modifier — навигатор файлов (щелчок заменяет набор, Ctrl/Cmd и Shift его строят), click — выбор из списка (щелчок и пробел переключают членство).',
    },
    {
      name: 'selectable',
      type: "'all' | 'leaf'",
      default: "'all'",
      description: 'Что можно выбрать. leaf — режим выбора файла: щелчок по ветке её раскрывает.',
    },
    {
      name: 'isNodeDisabled',
      type: '(node: TreeNode) => boolean',
      description:
        'Запрет выбора поверх node.disabled — для запретов динамических: достигнутый потолок числа выбранных, права на конкретный файл.',
    },
    {
      name: 'onActivate',
      type: '(node: TreeNode, meta: { preview: boolean }) => void',
      description:
        'Запуск строки. preview=true — одиночный щелчок или пробел, false — двойной щелчок или Enter. Ветку дерево раскрывает само и наружу не сообщает.',
    },
    {
      name: 'onRowClick',
      type: '(node: TreeNode, event: React.MouseEvent) => void',
      description:
        'Щелчок ДО правил выбора дерева. Вызвавший preventDefault() берёт строку себе целиком.',
    },
    {
      name: 'onRowDoubleClick',
      type: '(node: TreeNode, event: React.MouseEvent) => void',
      description: 'Двойной щелчок ДО запуска строки; preventDefault отменяет запуск.',
    },
    {
      name: 'onContextMenu',
      type: 'React.MouseEventHandler<HTMLDivElement>',
      description: 'Правый щелчок по дереву целиком; строку потребитель находит по data-tree-id.',
    },
    {
      name: 'getRowProps',
      type: '(node: TreeNode, row: TreeRow) => HTMLAttributes',
      description: 'Доп. атрибуты строки: свои data-*, title, обработчики.',
    },
    {
      name: 'search',
      type: 'string',
      description:
        'Запрос по подписи. Путь до совпадения раскрывается на время поиска; фильтр видит только прочитанные уровни.',
    },
    { name: 'emptyText', type: 'string', default: "'Пусто'", description: 'Текст пустого дерева.' },
    {
      name: 'rowHeight',
      type: 'number',
      default: '24',
      description: 'Высота строки, px. На ней стоит виртуальный скролл.',
    },
    {
      name: 'maxRows',
      type: 'number',
      description:
        'Сколько строк показать до появления прокрутки. Задаёт высоту по содержимому; без него высоту задаёт className вызывающего.',
    },
    { name: 'indent', type: 'number', default: '12', description: 'Отступ уровня, px.' },
    {
      name: 'indentBase',
      type: 'number',
      default: '8',
      description: 'Отступ первого уровня от левого края, px.',
    },
    {
      name: 'virtualized',
      type: 'boolean',
      default: 'true',
      description:
        'Виртуальный скролл. Выключают там, где дерево заведомо короткое, а разметка нужна целиком (серверная отрисовка).',
    },
    {
      name: 'renderIcon',
      type: '(node: TreeNode, state: { branch, expanded }) => ReactNode',
      description: 'Значок строки; возврат null оставляет умолчание (каталог / файл).',
    },
    {
      name: 'renderLabel',
      type: '(node: TreeNode, state: TreeRenderState) => ReactNode',
      description: 'Подпись строки; возврат null оставляет node.label.',
    },
    {
      name: 'renderActions',
      type: '(node: TreeNode, state: TreeRenderState) => ReactNode',
      description: 'Содержимое правого края строки: свои метки, кнопки, подсказки.',
    },
    {
      name: 'onLoadError',
      type: '(error: unknown, node: TreeNode | null) => void',
      description: 'Отказ чтения уровня. По умолчанию пишется в консоль.',
    },
    { name: 'className', type: 'string', description: 'Доп. CSS-класс контейнера дерева.' },
    {
      name: 'id',
      type: 'string',
      description: 'id контейнера — по нему подпись снаружи связывается с деревом.',
    },
    {
      name: 'data-testid',
      type: 'string',
      description:
        'Префикс: сам на корне, «-<id узла>» на строке, «-<id узла>-chevron» на треугольнике.',
    },
  ],
};
