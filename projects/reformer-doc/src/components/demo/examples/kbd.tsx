import { Kbd, KbdGroup } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Kbd — не form-control: презентационная разметка клавиш. Таб Variants показывает готовые
 * пресеты (одиночная клавиша / группа-комбинация), Examples — приёмы (подсказка в тексте,
 * комбинация с разделителем), API — таблица props. Form-bound таба (api) нет.
 */
export const kbdDocConfig: ComponentDocConfig = {
  name: 'Kbd',
  importFrom: '@reformer/ui-kit',
  description:
    'Клавиша/сочетание клавиш на shadcn. Kbd — одна клавиша (<kbd>), KbdGroup — контейнер для комбинации нескольких клавиш.',
  variants: [
    {
      id: 'single',
      title: 'Одиночная клавиша',
      description: 'Kbd рендерит семантический <kbd> — для одной клавиши или короткого ярлыка.',
      render: () => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Kbd>Ctrl</Kbd>
          <Kbd>⌘</Kbd>
          <Kbd>Shift</Kbd>
          <Kbd>Esc</Kbd>
          <Kbd>↵</Kbd>
        </div>
      ),
      code: `<Kbd>Ctrl</Kbd>
<Kbd>⌘</Kbd>
<Kbd>Shift</Kbd>
<Kbd>Esc</Kbd>
<Kbd>↵</Kbd>`,
    },
    {
      id: 'group',
      title: 'Группа клавиш (комбинация)',
      description: 'KbdGroup выстраивает несколько Kbd в ряд с равным зазором — для сочетаний.',
      render: () => (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>Shift</Kbd>
            <Kbd>P</Kbd>
          </KbdGroup>
        </div>
      ),
      code: `<KbdGroup>
  <Kbd>Ctrl</Kbd>
  <Kbd>K</Kbd>
</KbdGroup>

<KbdGroup>
  <Kbd>⌘</Kbd>
  <Kbd>Shift</Kbd>
  <Kbd>P</Kbd>
</KbdGroup>`,
    },
  ],
  examples: [
    {
      id: 'inline-hint',
      title: 'Подсказка в тексте',
      description:
        'Kbd встраивается в строку текста как инлайн-элемент — для подсказки о горячей клавише.',
      render: () => (
        <p style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>
          Нажмите{' '}
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>{' '}
          для поиска.
        </p>
      ),
      code: `<p>
  Нажмите{' '}
  <KbdGroup>
    <Kbd>Ctrl</Kbd>
    <Kbd>K</Kbd>
  </KbdGroup>{' '}
  для поиска.
</p>`,
    },
    {
      id: 'combo-separator',
      title: 'Комбинация с разделителем',
      description:
        'Между клавишами можно поставить текстовый разделитель («+» или «then») — он остаётся вне <kbd>.',
      render: () => (
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <span style={{ fontSize: 12, opacity: 0.6 }}>+</span>
          <Kbd>Alt</Kbd>
          <span style={{ fontSize: 12, opacity: 0.6 }}>+</span>
          <Kbd>Del</Kbd>
        </KbdGroup>
      ),
      code: `<KbdGroup>
  <Kbd>Ctrl</Kbd>
  <span>+</span>
  <Kbd>Alt</Kbd>
  <span>+</span>
  <Kbd>Del</Kbd>
</KbdGroup>`,
    },
  ],
  props: [
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Содержимое клавиши (Kbd) или набор Kbd внутри группы (KbdGroup).',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
