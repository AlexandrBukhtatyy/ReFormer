import {
  Item,
  ItemGroup,
  ItemSeparator,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemHeader,
  ItemFooter,
  Button,
  Badge,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Item — не form-control: compound-строка списка (Item / ItemGroup / ItemSeparator /
 * ItemMedia / ItemContent / ItemTitle / ItemDescription / ItemActions / ItemHeader / ItemFooter).
 * Таб Variants показывает cva-пресеты (variant default / outline / muted, size default / sm),
 * Examples — приёмы (медиа + контент + действия, группа с разделителями, кликабельная строка через
 * asChild, header/footer на всю ширину), API — таблица частей и общих props.
 */

// Небольшая inline-иконка (чтобы demo не зависел от icon-библиотеки в render).
function FileIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

export const itemDocConfig: ComponentDocConfig = {
  name: 'Item',
  importFrom: '@reformer/ui-kit',
  description:
    'Строка списка на shadcn — универсальный «ряд» с медиа, контентом (заголовок + описание) и действиями. Compound: Item (контейнер, variant / size) + ItemGroup / ItemSeparator + ItemMedia / ItemContent / ItemTitle / ItemDescription / ItemActions / ItemHeader / ItemFooter. Все части несут свой data-slot.',
  variants: [
    {
      id: 'variants',
      title: 'Варианты стиля (variant)',
      description: 'variant: default (без рамки) / outline (рамка) / muted (приглушённый фон).',
      render: () => (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: '100%',
            maxWidth: 420,
          }}
        >
          <Item variant="default">
            <ItemContent>
              <ItemTitle>Default</ItemTitle>
              <ItemDescription>Прозрачный фон, без рамки.</ItemDescription>
            </ItemContent>
          </Item>
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Outline</ItemTitle>
              <ItemDescription>Обведён рамкой (border-border).</ItemDescription>
            </ItemContent>
          </Item>
          <Item variant="muted">
            <ItemContent>
              <ItemTitle>Muted</ItemTitle>
              <ItemDescription>Приглушённый фон (bg-muted/50).</ItemDescription>
            </ItemContent>
          </Item>
        </div>
      ),
      code: `<Item variant="default">…</Item>
<Item variant="outline">…</Item>
<Item variant="muted">…</Item>`,
    },
    {
      id: 'sizes',
      title: 'Размеры (size)',
      description: 'size: default (gap-4 p-4) / sm (компактнее — gap-2.5 px-4 py-3).',
      render: () => (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: '100%',
            maxWidth: 420,
          }}
        >
          <Item variant="outline" size="default">
            <ItemContent>
              <ItemTitle>Default</ItemTitle>
              <ItemDescription>Стандартные отступы.</ItemDescription>
            </ItemContent>
          </Item>
          <Item variant="outline" size="sm">
            <ItemContent>
              <ItemTitle>Small</ItemTitle>
              <ItemDescription>Компактная строка.</ItemDescription>
            </ItemContent>
          </Item>
        </div>
      ),
      code: `<Item size="default">…</Item>
<Item size="sm">…</Item>`,
    },
  ],
  examples: [
    {
      id: 'media-content-actions',
      title: 'Медиа + контент + действия',
      description:
        'ItemMedia (variant="icon") слева, ItemContent (заголовок + описание) по центру, ItemActions справа.',
      render: () => (
        <Item variant="outline" style={{ width: '100%', maxWidth: 420 }}>
          <ItemMedia variant="icon">
            <FileIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Отчёт за квартал.pdf</ItemTitle>
            <ItemDescription>2.4 МБ · обновлён вчера</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="sm">
              Скачать
            </Button>
          </ItemActions>
        </Item>
      ),
      code: `<Item variant="outline">
  <ItemMedia variant="icon">
    <FileText />
  </ItemMedia>
  <ItemContent>
    <ItemTitle>Отчёт за квартал.pdf</ItemTitle>
    <ItemDescription>2.4 МБ · обновлён вчера</ItemDescription>
  </ItemContent>
  <ItemActions>
    <Button variant="ghost" size="sm">Скачать</Button>
  </ItemActions>
</Item>`,
    },
    {
      id: 'group-separators',
      title: 'Группа с разделителями (ItemGroup)',
      description:
        'ItemGroup (role="list") оборачивает набор строк, ItemSeparator рисует горизонтальную линию между ними.',
      render: () => (
        <ItemGroup style={{ width: '100%', maxWidth: 420 }}>
          <Item>
            <ItemContent>
              <ItemTitle>Анна Петрова</ItemTitle>
              <ItemDescription>anna@example.com</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="secondary">Админ</Badge>
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item>
            <ItemContent>
              <ItemTitle>Иван Смирнов</ItemTitle>
              <ItemDescription>ivan@example.com</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="outline">Гость</Badge>
            </ItemActions>
          </Item>
        </ItemGroup>
      ),
      code: `<ItemGroup>
  <Item>…</Item>
  <ItemSeparator />
  <Item>…</Item>
</ItemGroup>`,
    },
    {
      id: 'as-child-link',
      title: 'Кликабельная строка (asChild)',
      description:
        'asChild сливает Item с дочерним <a> — вся строка становится ссылкой (стили ховера применяются к [a]).',
      render: () => (
        <Item asChild variant="outline" style={{ width: '100%', maxWidth: 420 }}>
          <a href="#item">
            <ItemContent>
              <ItemTitle>Открыть настройки</ItemTitle>
              <ItemDescription>Вся строка — одна ссылка.</ItemDescription>
            </ItemContent>
          </a>
        </Item>
      ),
      code: `<Item asChild variant="outline">
  <a href="/settings">
    <ItemContent>
      <ItemTitle>Открыть настройки</ItemTitle>
      <ItemDescription>Вся строка — одна ссылка.</ItemDescription>
    </ItemContent>
  </a>
</Item>`,
    },
    {
      id: 'header-footer',
      title: 'Шапка и подвал (ItemHeader / ItemFooter)',
      description:
        'ItemHeader и ItemFooter занимают всю ширину (basis-full) — над и под основным рядом строки.',
      render: () => (
        <Item variant="outline" style={{ width: '100%', maxWidth: 420 }}>
          <ItemHeader>
            <ItemTitle>Проект «Атлас»</ItemTitle>
            <Badge variant="secondary">Активен</Badge>
          </ItemHeader>
          <ItemContent>
            <ItemDescription>12 участников · 34 задачи открыто</ItemDescription>
          </ItemContent>
          <ItemFooter>
            <span>Обновлён 2 часа назад</span>
            <Button variant="ghost" size="sm">
              Детали
            </Button>
          </ItemFooter>
        </Item>
      ),
      code: `<Item variant="outline">
  <ItemHeader>
    <ItemTitle>Проект «Атлас»</ItemTitle>
    <Badge variant="secondary">Активен</Badge>
  </ItemHeader>
  <ItemContent>
    <ItemDescription>12 участников · 34 задачи открыто</ItemDescription>
  </ItemContent>
  <ItemFooter>
    <span>Обновлён 2 часа назад</span>
    <Button variant="ghost" size="sm">Детали</Button>
  </ItemFooter>
</Item>`,
    },
  ],
  props: [
    {
      name: 'Item',
      type: 'div',
      description:
        'Корневой контейнер строки: flex-ряд, скругление, focus-ring. Принимает variant / size / asChild.',
    },
    {
      name: 'variant',
      type: "'default' | 'outline' | 'muted'",
      default: 'default',
      description: 'Вариант стиля Item: прозрачный / с рамкой / приглушённый фон.',
    },
    {
      name: 'size',
      type: "'default' | 'sm'",
      default: 'default',
      description: 'Плотность отступов Item: стандартная (p-4) / компактная (px-4 py-3).',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Слить Item с единственным дочерним элементом (напр. <a>) вместо <div> (Radix Slot).',
    },
    {
      name: 'ItemGroup',
      type: 'div',
      description: 'Обёртка списка строк (role="list").',
    },
    {
      name: 'ItemSeparator',
      type: 'Separator',
      description: 'Горизонтальный разделитель между строками (на основе Separator).',
    },
    {
      name: 'ItemMedia',
      type: 'div',
      description:
        'Слот медиа слева. variant: default / icon (квадрат с рамкой) / image (обрезка под квадрат).',
    },
    {
      name: 'ItemContent',
      type: 'div',
      description: 'Центральная колонка: заголовок и описание (flex-1, вертикальный стек).',
    },
    {
      name: 'ItemTitle',
      type: 'div',
      description: 'Заголовок строки (font-medium, text-sm).',
    },
    {
      name: 'ItemDescription',
      type: 'p',
      description: 'Описание / подпись (muted-foreground, line-clamp-2).',
    },
    {
      name: 'ItemActions',
      type: 'div',
      description: 'Слот действий справа (кнопки, бейджи).',
    },
    {
      name: 'ItemHeader',
      type: 'div',
      description: 'Шапка на всю ширину строки (basis-full), над основным рядом.',
    },
    {
      name: 'ItemFooter',
      type: 'div',
      description: 'Подвал на всю ширину строки (basis-full), под основным рядом.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
