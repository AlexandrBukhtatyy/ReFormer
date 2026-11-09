import { FileText } from 'lucide-react';
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
 * Item — не поле формы: строка с медиа, текстом и действиями (Item / ItemGroup / ItemSeparator /
 * ItemMedia / ItemContent / ItemTitle / ItemDescription / ItemActions / ItemHeader / ItemFooter).
 * Variants — variant и size, Examples — типовые строки, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо (ширина), в `code` её нет.
 */

export const itemDocConfig: ComponentDocConfig = {
  name: 'Item',
  importFrom: '@reformer/ui-kit',
  description:
    'Строка с медиа, заголовком, описанием и действиями. Собирается из частей, каждую можно опустить.',
  variants: [
    {
      id: 'default',
      title: 'Без рамки (variant="default")',
      description: 'Прозрачный фон и прозрачная рамка — строка сливается с фоном.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Item variant="default">
            <ItemContent>
              <ItemTitle>Договор подписан</ItemTitle>
              <ItemDescription>Сегодня в 14:20</ItemDescription>
            </ItemContent>
          </Item>
        </div>
      ),
      code: `<Item variant="default">
  <ItemContent>
    <ItemTitle>Договор подписан</ItemTitle>
    <ItemDescription>Сегодня в 14:20</ItemDescription>
  </ItemContent>
</Item>`,
    },
    {
      id: 'outline',
      title: 'С рамкой (variant="outline")',
      description: 'Видимая рамка — строка читается как отдельная карточка.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Договор подписан</ItemTitle>
              <ItemDescription>Сегодня в 14:20</ItemDescription>
            </ItemContent>
          </Item>
        </div>
      ),
      code: `<Item variant="outline">
  <ItemContent>
    <ItemTitle>Договор подписан</ItemTitle>
    <ItemDescription>Сегодня в 14:20</ItemDescription>
  </ItemContent>
</Item>`,
    },
    {
      id: 'muted',
      title: 'Приглушённый фон (variant="muted")',
      description: 'Серый фон без рамки — для второстепенных строк.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Item variant="muted">
            <ItemContent>
              <ItemTitle>Договор подписан</ItemTitle>
              <ItemDescription>Сегодня в 14:20</ItemDescription>
            </ItemContent>
          </Item>
        </div>
      ),
      code: `<Item variant="muted">
  <ItemContent>
    <ItemTitle>Договор подписан</ItemTitle>
    <ItemDescription>Сегодня в 14:20</ItemDescription>
  </ItemContent>
</Item>`,
    },
    {
      id: 'small',
      title: 'Компактная строка (size="sm")',
      description: 'Меньше отступы и зазоры — для плотных списков.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Item variant="outline" size="sm">
            <ItemContent>
              <ItemTitle>Договор подписан</ItemTitle>
            </ItemContent>
          </Item>
        </div>
      ),
      code: `<Item variant="outline" size="sm">
  <ItemContent>
    <ItemTitle>Договор подписан</ItemTitle>
  </ItemContent>
</Item>`,
    },
  ],
  examples: [
    {
      id: 'media-content-actions',
      title: 'Медиа, текст и действие',
      description:
        'ItemMedia с variant="icon" слева, ItemContent в центре, ItemActions справа. Иконки lucide скрыты от скринридера сами.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Item variant="outline">
            <ItemMedia variant="icon">
              <FileText />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Отчёт за квартал.pdf</ItemTitle>
              <ItemDescription>2,4 МБ · обновлён вчера</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="ghost" size="sm">
                Скачать
              </Button>
            </ItemActions>
          </Item>
        </div>
      ),
      code: `import { FileText } from 'lucide-react';

<Item variant="outline">
  <ItemMedia variant="icon">
    <FileText />
  </ItemMedia>
  <ItemContent>
    <ItemTitle>Отчёт за квартал.pdf</ItemTitle>
    <ItemDescription>2,4 МБ · обновлён вчера</ItemDescription>
  </ItemContent>
  <ItemActions>
    <Button variant="ghost" size="sm">
      Скачать
    </Button>
  </ItemActions>
</Item>`,
    },
    {
      id: 'group-separators',
      title: 'Список строк (ItemGroup)',
      description:
        'ItemGroup ставит role="list", а Item внутри него сам становится role="listitem". ItemSeparator — линия между строками.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <ItemGroup>
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
        </div>
      ),
      code: `<ItemGroup>
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
</ItemGroup>`,
    },
    {
      id: 'as-child-link',
      title: 'Строка-ссылка (asChild)',
      description:
        'asChild отдаёт стили строки дочернему <a>: вся строка — одна ссылка с подсветкой при наведении и кольцом фокуса.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Item asChild variant="outline">
            <a href="#settings">
              <ItemContent>
                <ItemTitle>Открыть настройки</ItemTitle>
                <ItemDescription>Вся строка — одна ссылка.</ItemDescription>
              </ItemContent>
            </a>
          </Item>
        </div>
      ),
      code: `<Item asChild variant="outline">
  <a href="#settings">
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
      description: 'ItemHeader и ItemFooter занимают всю ширину строки — над и под основным рядом.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Item variant="outline">
            <ItemHeader>
              <ItemTitle>Проект «Атлас»</ItemTitle>
              <Badge variant="secondary">Активен</Badge>
            </ItemHeader>
            <ItemContent>
              <ItemDescription>12 участников · 34 открытые задачи</ItemDescription>
            </ItemContent>
            <ItemFooter>
              <span>Обновлён 2 часа назад</span>
              <Button variant="ghost" size="sm">
                Детали
              </Button>
            </ItemFooter>
          </Item>
        </div>
      ),
      code: `<Item variant="outline">
  <ItemHeader>
    <ItemTitle>Проект «Атлас»</ItemTitle>
    <Badge variant="secondary">Активен</Badge>
  </ItemHeader>
  <ItemContent>
    <ItemDescription>12 участников · 34 открытые задачи</ItemDescription>
  </ItemContent>
  <ItemFooter>
    <span>Обновлён 2 часа назад</span>
    <Button variant="ghost" size="sm">
      Детали
    </Button>
  </ItemFooter>
</Item>`,
    },
  ],
  props: [
    {
      name: 'variant',
      type: "'default' | 'outline' | 'muted'",
      default: "'default'",
      description: 'Вид строки: без рамки, с рамкой, с приглушённым фоном.',
    },
    {
      name: 'size',
      type: "'default' | 'sm'",
      default: "'default'",
      description: 'Плотность: обычные отступы или компактные.',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Отдать стили строки единственному дочернему элементу (a, button) вместо своего div.',
    },
    {
      name: 'role',
      type: 'string',
      description:
        'Вне списка своей роли у Item нет. Внутри ItemGroup с role="list" Item сам получает role="listitem" (с asChild — его обёртка). Явный role перекрывает.',
    },
    {
      name: 'ItemMedia.variant',
      type: "'default' | 'icon' | 'image'",
      default: "'default'",
      description:
        'Слот слева: как есть, квадрат с рамкой и фоном под иконку или квадрат 40px с обрезкой под картинку.',
    },
    {
      name: 'ItemContent',
      type: 'div',
      description:
        'Колонка текста: занимает свободное место, внутри — ItemTitle и ItemDescription.',
    },
    {
      name: 'ItemTitle',
      type: 'div',
      description: 'Заголовок строки. Это div, а не заголовок h1–h6.',
    },
    {
      name: 'ItemDescription',
      type: 'p',
      description: 'Описание приглушённым цветом. Обрезается после двух строк (line-clamp-2).',
    },
    {
      name: 'ItemActions',
      type: 'div',
      description: 'Кнопки и бейджи справа.',
    },
    {
      name: 'ItemHeader / ItemFooter',
      type: 'div',
      description: 'Ряд на всю ширину строки над основным рядом и под ним.',
    },
    {
      name: 'ItemGroup',
      type: 'div',
      description:
        'Контейнер списка строк с role="list"; Item внутри получают role="listitem". Своя роль (например, "none") снимает и роль listitem у строк.',
    },
    {
      name: 'ItemSeparator',
      type: 'Separator',
      description: 'Горизонтальная линия между строками. Декоративная: скринридер её пропускает.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
