import {
  ButtonGroup,
  ButtonGroupText,
  ButtonGroupSeparator,
  Button,
  Input,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * ButtonGroup — не поле формы: презентационный набор (ButtonGroup / ButtonGroupText /
 * ButtonGroupSeparator). Склеивает соседние элементы в один сегмент: снимает внутренние скругления
 * и двойные границы. Variants — готовые композиции, Examples — приёмы (кнопка с меню, поле с
 * кнопкой, вложенные группы), API — таблица props.
 */
export const buttonGroupDocConfig: ComponentDocConfig = {
  name: 'ButtonGroup',
  importFrom: '@reformer/ui-kit',
  description:
    'Склеивает соседние кнопки, поля и подписи в один сегмент: убирает внутренние скругления и двойные границы.',
  variants: [
    {
      id: 'basic',
      title: 'Группа кнопок',
      description: 'Соседние Button склеиваются: внутренние углы и границы убираются.',
      render: () => (
        <ButtonGroup aria-label="Выравнивание">
          <Button variant="outline">Слева</Button>
          <Button variant="outline">По центру</Button>
          <Button variant="outline">Справа</Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup aria-label="Выравнивание">
  <Button variant="outline">Слева</Button>
  <Button variant="outline">По центру</Button>
  <Button variant="outline">Справа</Button>
</ButtonGroup>`,
    },
    {
      id: 'vertical',
      title: 'Вертикальная группа',
      description: 'orientation="vertical" — кнопки в столбец, склеены верхние и нижние края.',
      render: () => (
        <ButtonGroup orientation="vertical" aria-label="Учётная запись">
          <Button variant="outline">Профиль</Button>
          <Button variant="outline">Настройки</Button>
          <Button variant="outline">Выход</Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup orientation="vertical" aria-label="Учётная запись">
  <Button variant="outline">Профиль</Button>
  <Button variant="outline">Настройки</Button>
  <Button variant="outline">Выход</Button>
</ButtonGroup>`,
    },
    {
      id: 'with-text',
      title: 'Подпись в сегменте (ButtonGroupText)',
      description:
        'ButtonGroupText — неинтерактивный блок в стиле сегмента: префикс, единица измерения, протокол.',
      render: () => (
        <ButtonGroup aria-label="Адрес сайта">
          <ButtonGroupText>https://</ButtonGroupText>
          <Button variant="outline">example.com</Button>
          <Button variant="outline">Копировать</Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup aria-label="Адрес сайта">
  <ButtonGroupText>https://</ButtonGroupText>
  <Button variant="outline">example.com</Button>
  <Button variant="outline">Копировать</Button>
</ButtonGroup>`,
    },
    {
      id: 'with-separator',
      title: 'Разделитель (ButtonGroupSeparator)',
      description:
        'ButtonGroupSeparator рисует линию между сегментами. Нужен у кнопок без рамки (secondary, default), где граница не видна.',
      render: () => (
        <ButtonGroup aria-label="Сохранение">
          <Button variant="secondary">Сохранить</Button>
          <ButtonGroupSeparator />
          <Button variant="secondary" aria-label="Другие варианты сохранения">
            ▾
          </Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup aria-label="Сохранение">
  <Button variant="secondary">Сохранить</Button>
  <ButtonGroupSeparator />
  <Button variant="secondary" aria-label="Другие варианты сохранения">
    ▾
  </Button>
</ButtonGroup>`,
    },
  ],
  examples: [
    {
      id: 'split-button',
      title: 'Основное действие и меню',
      description:
        'Основное действие слева, кнопка-иконка меню справа, между ними ButtonGroupSeparator. У кнопки-иконки обязательно aria-label.',
      render: () => (
        <ButtonGroup aria-label="Публикация">
          <Button>Опубликовать</Button>
          <ButtonGroupSeparator />
          <Button size="icon" aria-label="Ещё">
            ⋯
          </Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup aria-label="Публикация">
  <Button>Опубликовать</Button>
  <ButtonGroupSeparator />
  <Button size="icon" aria-label="Ещё">
    ⋯
  </Button>
</ButtonGroup>`,
    },
    {
      id: 'input-and-button',
      title: 'Поле и кнопка',
      description:
        'Input в группе растягивается (flex-1), кнопка прижимается к нему. Подпись полю даёт aria-label: видимого label здесь нет.',
      render: () => (
        <ButtonGroup aria-label="Поиск">
          <Input placeholder="Поиск по документам" aria-label="Поисковый запрос" />
          <Button variant="outline">Найти</Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup aria-label="Поиск">
  <Input placeholder="Поиск по документам" aria-label="Поисковый запрос" />
  <Button variant="outline">Найти</Button>
</ButtonGroup>`,
    },
    {
      id: 'nested-groups',
      title: 'Вложенные группы',
      description:
        'ButtonGroup внутри ButtonGroup: внешняя группа ставит между вложенными зазор. Так собирают панель инструментов.',
      render: () => (
        <ButtonGroup aria-label="Панель форматирования">
          <ButtonGroup aria-label="Начертание">
            <Button variant="outline">B</Button>
            <Button variant="outline">I</Button>
            <Button variant="outline">U</Button>
          </ButtonGroup>
          <ButtonGroup aria-label="Выравнивание">
            <Button variant="outline">Слева</Button>
            <Button variant="outline">Центр</Button>
            <Button variant="outline">Справа</Button>
          </ButtonGroup>
        </ButtonGroup>
      ),
      code: `<ButtonGroup aria-label="Панель форматирования">
  <ButtonGroup aria-label="Начертание">
    <Button variant="outline">B</Button>
    <Button variant="outline">I</Button>
    <Button variant="outline">U</Button>
  </ButtonGroup>
  <ButtonGroup aria-label="Выравнивание">
    <Button variant="outline">Слева</Button>
    <Button variant="outline">Центр</Button>
    <Button variant="outline">Справа</Button>
  </ButtonGroup>
</ButtonGroup>`,
    },
  ],
  props: [
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      default: "'horizontal'",
      description:
        'Направление группы: в ряд или в столбец. Ставит data-orientation; aria-orientation не ставит.',
    },
    {
      name: 'aria-label',
      type: 'string',
      description:
        'Название группы для скринридера. Компонент ставит role="group", но имени ему не даёт — задайте его сами.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
    {
      name: 'ButtonGroupText.asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Передать стиль сегмента дочернему элементу вместо своего div — например, label для поля в группе.',
    },
    {
      name: 'ButtonGroupSeparator.orientation',
      type: "'vertical' | 'horizontal'",
      default: "'vertical'",
      description:
        'Направление линии. В вертикальной группе разделителю нужен orientation="horizontal".',
    },
    {
      name: 'ButtonGroupSeparator.decorative',
      type: 'boolean',
      default: 'true',
      description:
        'Декоративная линия скрыта от скринридера (role="none"). false — role="separator".',
    },
    {
      name: 'buttonGroupVariants',
      type: '({ orientation }) => string',
      description:
        'Классы группы (cva) для своего контейнера, который должен выглядеть как ButtonGroup.',
    },
  ],
};
