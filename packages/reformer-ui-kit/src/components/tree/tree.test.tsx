import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Tree } from './index';
import type { TreeNode } from './index';

/**
 * Разметка дерева в SSR. Эффекты здесь не выполняются, поэтому проверяется ровно то, что
 * дерево рисует ПЕРВЫМ кадром: строки объявленных узлов, их уровни, значки и атрибуты.
 * Раскрытие щелчком, ленивое чтение уровня, фокус и прокрутка живут только в браузере
 * и закрываются e2e; правила, стоящие за ними, — в `tree-model.test.ts`.
 */

const NODES: readonly TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    kind: 'branch',
    children: [
      { id: 'src/index.ts', label: 'index.ts' },
      { id: 'src/app.tsx', label: 'app.tsx', badge: 'MOD', badgeTone: 'secondary' },
    ],
  },
  { id: 'README.md', label: 'README.md' },
];

describe('Tree (вариант base)', () => {
  it('корень объявляет себя деревом', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} />);
    expect(html).toContain('role="tree"');
    expect(html).toContain('data-slot="tree"');
  });

  it('строки верхнего уровня — treeitem первого уровня', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} />);
    expect(html).toContain('role="treeitem"');
    expect(html).toContain('aria-level="1"');
    expect(html).toContain('data-node-id="src"');
    expect(html).toContain('data-tree-id="README.md"');
  });

  it('свёрнутая ветка своих детей не показывает', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} />);
    expect(html).not.toContain('index.ts');
    expect(html).toContain('aria-expanded="false"');
  });

  it('defaultExpandedIds раскрывает ветку — дети приходят вторым уровнем', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} defaultExpandedIds={['src']} />);
    expect(html).toContain('index.ts');
    expect(html).toContain('aria-level="2"');
    expect(html).toContain('aria-expanded="true"');
  });

  it('уровень выражен отступом слева: 8px база плюс 12px на уровень', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} defaultExpandedIds={['src']} />);
    expect(html).toContain('padding-left:8px');
    expect(html).toContain('padding-left:20px');
  });

  it('треугольник рисуется только у ветки', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} data-testid="t" />);
    expect(html).toContain('data-testid="t-src-chevron"');
    expect(html).not.toContain('data-testid="t-README.md-chevron"');
  });

  it('data-testid корня раздаётся строкам как префикс — по нему их находит e2e', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} data-testid="files" />);
    expect(html).toContain('data-testid="files"');
    expect(html).toContain('data-testid="files-src"');
    expect(html).toContain('data-testid="files-README.md"');
  });

  it('без data-testid строки его не получают (нет мусорных undefined-атрибутов)', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} />);
    expect(html).not.toContain('data-testid');
  });

  it('выделение объявляется и стилем, и ARIA', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} defaultSelectedId="README.md" />);
    expect(html).toContain('data-selected="true"');
    expect(html).toContain('aria-selected="true"');
  });

  it('набор объявляет дерево множественно выбираемым', () => {
    const html = renderToStaticMarkup(
      <Tree nodes={NODES} selectionMode="multiple" defaultCheckedIds={['README.md']} />
    );
    expect(html).toContain('aria-multiselectable="true"');
    expect(html).toContain('data-checked="true"');
  });

  it('в одиночном режиме отметок нет, даже если они переданы', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} checkedIds={['README.md']} />);
    expect(html).not.toContain('data-checked');
  });

  it('метка узла рисуется значком-бейджем', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} defaultExpandedIds={['src']} />);
    expect(html).toContain('MOD');
  });

  it('пустое дерево показывает свой текст, а не пустоту', () => {
    const html = renderToStaticMarkup(<Tree nodes={[]} emptyText="Файлов нет" />);
    expect(html).toContain('Файлов нет');
    expect(html).toContain('data-slot="tree-empty"');
  });

  it('поиск оставляет совпадение и путь до него, пряча остальное', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} search="app" />);
    expect(html).toContain('app.tsx');
    expect(html).toContain('src');
    expect(html).not.toContain('README.md');
  });

  it('нечитанный уровень ветки показывает спиннер вместо треугольника', () => {
    const lazy: TreeNode[] = [{ id: 'dir', label: 'dir', kind: 'branch', loading: true }];
    const html = renderToStaticMarkup(<Tree nodes={lazy} data-testid="t" />);
    expect(html).toContain('data-slot="tree-item-loader"');
    expect(html).not.toContain('data-testid="t-dir-chevron"');
  });

  it('renderActions добавляет содержимое в правый край строки', () => {
    const html = renderToStaticMarkup(
      <Tree nodes={NODES} renderActions={(node) => <span>{`~${node.id}`}</span>} />
    );
    expect(html).toContain('~README.md');
  });

  it('getRowProps прокидывает свои атрибуты на строку', () => {
    const html = renderToStaticMarkup(
      <Tree nodes={NODES} getRowProps={(node) => ({ 'data-resource-id': node.id })} />
    );
    expect(html).toContain('data-resource-id="src"');
  });

  it('высота строки настраивается и уходит в разметку', () => {
    const html = renderToStaticMarkup(<Tree nodes={NODES} rowHeight={32} />);
    expect(html).toContain('height:32px');
  });

  it('id и aria-* ложатся на контейнер дерева', () => {
    const html = renderToStaticMarkup(
      <Tree nodes={NODES} id="files-tree" aria-label="Файлы проекта" aria-describedby="hint" />
    );
    expect(html).toContain('id="files-tree"');
    expect(html).toContain('aria-label="Файлы проекта"');
    expect(html).toContain('aria-describedby="hint"');
  });

  it('без виртуализации распорки нет — разметка приходит целиком', () => {
    // Прямая проверка того, ради чего проп и заведён: серверная отрисовка страницы
    // документации не должна отдавать окно из девяти строк вместо дерева.
    const many: TreeNode[] = Array.from({ length: 40 }, (_, i) => ({
      id: `f${i}`,
      label: `file-${i}.ts`,
    }));
    const html = renderToStaticMarkup(<Tree nodes={many} virtualized={false} />);
    expect(html).toContain('file-39.ts');
  });

  it('maxRows задаёт высоту по содержимому, а не фиксированную', () => {
    const three: TreeNode[] = [
      { id: 'a', label: 'a' },
      { id: 'b', label: 'b' },
      { id: 'c', label: 'c' },
    ];
    // Три строки по 24 px плюс 8 px внутренних отступов ряда.
    expect(renderToStaticMarkup(<Tree nodes={three} maxRows={10} />)).toContain('height:80px');
    // Потолок в две строки обрезает высоту и включает прокрутку.
    expect(renderToStaticMarkup(<Tree nodes={three} maxRows={2} />)).toContain('height:56px');
  });
});
