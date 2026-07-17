import { ButtonGroup, ButtonGroupText, ButtonGroupSeparator, Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * ButtonGroup — не form-control: compound-набор презентационных блоков (ButtonGroup / ButtonGroupText /
 * ButtonGroupSeparator). Склеивает соседние элементы в единый сегмент (сбрасывает внутренние скругления
 * и границы). Таб Variants показывает готовые композиции, Examples — приёмы (split-кнопка, вложенные
 * группы), API — таблицу частей и props.
 */
export const buttonGroupDocConfig: ComponentDocConfig = {
  name: 'ButtonGroup',
  importFrom: '@reformer/ui-kit',
  description:
    'Группа кнопок на shadcn: склеивает соседние элементы в единый сегмент (убирает внутренние скругления и двойные границы). orientation — горизонтальная/вертикальная. ButtonGroupText — addon-подпись, ButtonGroupSeparator — разделитель.',
  variants: [
    {
      id: 'basic',
      title: 'Группа кнопок',
      description: 'Соседние Button склеиваются: внутренние углы и границы убираются.',
      render: () => (
        <ButtonGroup>
          <Button variant="outline">Слева</Button>
          <Button variant="outline">По центру</Button>
          <Button variant="outline">Справа</Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup>
  <Button variant="outline">Слева</Button>
  <Button variant="outline">По центру</Button>
  <Button variant="outline">Справа</Button>
</ButtonGroup>`,
    },
    {
      id: 'vertical',
      title: 'Вертикальная группа',
      description: 'orientation="vertical" — кнопки в столбец (сбрасываются верх/низ скругления).',
      render: () => (
        <ButtonGroup orientation="vertical">
          <Button variant="outline">Профиль</Button>
          <Button variant="outline">Настройки</Button>
          <Button variant="outline">Выход</Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup orientation="vertical">
  <Button variant="outline">Профиль</Button>
  <Button variant="outline">Настройки</Button>
  <Button variant="outline">Выход</Button>
</ButtonGroup>`,
    },
    {
      id: 'with-text',
      title: 'Addon-подпись (ButtonGroupText)',
      description: 'ButtonGroupText — неинтерактивный блок (префикс/суффикс) в общем сегменте.',
      render: () => (
        <ButtonGroup>
          <ButtonGroupText>https://</ButtonGroupText>
          <Button variant="outline">example.com</Button>
          <Button variant="outline">Копировать</Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup>
  <ButtonGroupText>https://</ButtonGroupText>
  <Button variant="outline">example.com</Button>
  <Button variant="outline">Копировать</Button>
</ButtonGroup>`,
    },
    {
      id: 'with-separator',
      title: 'Разделитель (ButtonGroupSeparator)',
      description:
        'ButtonGroupSeparator ставит вертикальную линию между сегментами — напр. основное действие и меню.',
      render: () => (
        <ButtonGroup>
          <Button variant="secondary">Сохранить</Button>
          <ButtonGroupSeparator />
          <Button variant="secondary">▾</Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup>
  <Button variant="secondary">Сохранить</Button>
  <ButtonGroupSeparator />
  <Button variant="secondary">▾</Button>
</ButtonGroup>`,
    },
  ],
  examples: [
    {
      id: 'split-button',
      title: 'Split-кнопка (действие + меню)',
      description:
        'Основное действие слева, компактная icon-кнопка меню справа, разделённые ButtonGroupSeparator.',
      render: () => (
        <ButtonGroup>
          <Button>Опубликовать</Button>
          <ButtonGroupSeparator />
          <Button size="icon" aria-label="Ещё">
            ⋯
          </Button>
        </ButtonGroup>
      ),
      code: `<ButtonGroup>
  <Button>Опубликовать</Button>
  <ButtonGroupSeparator />
  <Button size="icon" aria-label="Ещё">⋯</Button>
</ButtonGroup>`,
    },
    {
      id: 'nested-groups',
      title: 'Вложенные группы (интервал между сегментами)',
      description:
        'Вложенный ButtonGroup внутри ButtonGroup получает отступ (has-[>[data-slot=button-group]]:gap-2) — так группируют панель инструментов.',
      render: () => (
        <ButtonGroup>
          <ButtonGroup>
            <Button variant="outline">B</Button>
            <Button variant="outline">I</Button>
            <Button variant="outline">U</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button variant="outline">Слева</Button>
            <Button variant="outline">Центр</Button>
            <Button variant="outline">Справа</Button>
          </ButtonGroup>
        </ButtonGroup>
      ),
      code: `<ButtonGroup>
  <ButtonGroup>
    <Button variant="outline">B</Button>
    <Button variant="outline">I</Button>
    <Button variant="outline">U</Button>
  </ButtonGroup>
  <ButtonGroup>
    <Button variant="outline">Слева</Button>
    <Button variant="outline">Центр</Button>
    <Button variant="outline">Справа</Button>
  </ButtonGroup>
</ButtonGroup>`,
    },
  ],
  props: [
    {
      name: 'ButtonGroup',
      type: 'div (role="group")',
      description:
        'Корневой контейнер: flex-сегмент, склеивающий детей. orientation задаёт направление.',
    },
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      default: 'horizontal',
      description: 'Направление группы: убирает боковые (h) или верх/низ (v) скругления и границы.',
    },
    {
      name: 'ButtonGroupText',
      type: 'div',
      description:
        'Неинтерактивный addon-блок (префикс/суффикс) со стилем сегмента (border, bg-muted). asChild — слить стиль на дочерний элемент.',
    },
    {
      name: 'ButtonGroupSeparator',
      type: 'Separator',
      description:
        'Разделитель между сегментами (по умолчанию orientation="vertical"). Обёртка над Separator.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
