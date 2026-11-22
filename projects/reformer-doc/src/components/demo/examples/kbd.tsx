import {
  Button,
  Kbd,
  KbdGroup,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Kbd — не поле формы: разметка клавиш (`<kbd>`). Kbd — одна клавиша, KbdGroup — сочетание.
 * Variants — одиночные клавиши и сочетания, Examples — подсказка в тексте, разделитель «+»,
 * клавиши в Tooltip, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо (ряд), в `code` её нет.
 */
export const kbdDocConfig: ComponentDocConfig = {
  name: 'Kbd',
  importFrom: '@reformer/ui-kit',
  description: 'Клавиша или сочетание клавиш: Kbd — одна клавиша, KbdGroup — сочетание.',
  variants: [
    {
      id: 'single',
      title: 'Одиночная клавиша',
      description: 'Kbd рисует элемент <kbd> для одной клавиши или символа.',
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
      title: 'Сочетание клавиш',
      description: 'KbdGroup ставит несколько Kbd в ряд с равным зазором.',
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
      description: 'Kbd и KbdGroup — строчные элементы, их ставят прямо в предложение.',
      render: () => (
        <p>
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
      title: 'Сочетание с разделителем',
      description: 'Знак «+» между клавишами — обычный текст рядом с Kbd, а не отдельная клавиша.',
      render: () => (
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <span className="text-xs text-muted-foreground">+</span>
          <Kbd>Alt</Kbd>
          <span className="text-xs text-muted-foreground">+</span>
          <Kbd>Del</Kbd>
        </KbdGroup>
      ),
      code: `<KbdGroup>
  <Kbd>Ctrl</Kbd>
  <span className="text-xs text-muted-foreground">+</span>
  <Kbd>Alt</Kbd>
  <span className="text-xs text-muted-foreground">+</span>
  <Kbd>Del</Kbd>
</KbdGroup>`,
    },
    {
      id: 'in-tooltip',
      title: 'Сочетание в подсказке',
      description:
        'Внутри TooltipContent Kbd сам меняет цвета под тёмный фон подсказки. Наведите курсор на кнопку.',
      render: () => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Сохранить</Button>
            </TooltipTrigger>
            <TooltipContent>
              Сохранить{' '}
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>S</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      code: `<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline">Сохранить</Button>
    </TooltipTrigger>
    <TooltipContent>
      Сохранить{' '}
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>S</Kbd>
      </KbdGroup>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>`,
    },
  ],
  props: [
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Kbd — название клавиши или символ, KbdGroup — несколько Kbd и разделители.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
    {
      name: 'title',
      type: 'string',
      description: 'Всплывающее пояснение к символу: title="Command" у ⌘.',
    },
    {
      name: '...props',
      type: "ComponentProps<'kbd'>",
      description:
        'Остальные атрибуты элемента kbd. У KbdGroup тип пропсов — div, хотя рисуется kbd.',
    },
  ],
};
