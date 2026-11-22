import { Icon } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Icon — не поле формы: иконка lucide по строковому имени (`iconName`). Имя сериализуемо, поэтому
 * Icon годится для JSON-документа renderer-json и билдера. Variants — имя, размер и толщина, цвет;
 * Examples — иконка в тексте, иконка со смыслом. Обёртка `<div style>` в render — рамка демо, в
 * `code` её нет.
 */
export const iconDocConfig: ComponentDocConfig = {
  name: 'Icon',
  importFrom: '@reformer/ui-kit',
  description: 'Иконка lucide по имени-строке: iconName, size, color, strokeWidth.',
  variants: [
    {
      id: 'names',
      title: 'Иконка по имени (iconName)',
      description:
        'Имя — как у компонента lucide, в PascalCase: House, Mail, Settings, ArrowRight. Неизвестное имя ничего не рисует.',
      render: () => (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Icon iconName="House" />
          <Icon iconName="Mail" />
          <Icon iconName="Settings" />
          <Icon iconName="ArrowRight" />
        </div>
      ),
      code: `<Icon iconName="House" />
<Icon iconName="Mail" />
<Icon iconName="Settings" />
<Icon iconName="ArrowRight" />`,
    },
    {
      id: 'size-stroke',
      title: 'Размер и толщина (size, strokeWidth)',
      description: 'size — сторона в пикселях (по умолчанию 24), strokeWidth — толщина линий (2).',
      render: () => (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Icon iconName="Star" size={16} />
          <Icon iconName="Star" size={24} />
          <Icon iconName="Star" size={32} strokeWidth={1.5} />
          <Icon iconName="Star" size={40} strokeWidth={1} />
        </div>
      ),
      code: `<Icon iconName="Star" size={16} />
<Icon iconName="Star" size={24} />
<Icon iconName="Star" size={32} strokeWidth={1.5} />
<Icon iconName="Star" size={40} strokeWidth={1} />`,
    },
    {
      id: 'color',
      title: 'Цвет',
      description:
        'По умолчанию иконка берёт цвет текста (currentColor). Класс text-* красит её цветом темы, проп color — любым CSS-цветом.',
      render: () => (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Icon iconName="CircleCheck" className="text-primary" />
          <Icon iconName="TriangleAlert" className="text-destructive" />
          <Icon iconName="Info" className="text-muted-foreground" />
          <Icon iconName="Heart" color="#e11d48" />
        </div>
      ),
      code: `<Icon iconName="CircleCheck" className="text-primary" />
<Icon iconName="TriangleAlert" className="text-destructive" />
<Icon iconName="Info" className="text-muted-foreground" />
<Icon iconName="Heart" color="#e11d48" />`,
    },
  ],
  examples: [
    {
      id: 'in-text',
      title: 'Иконка рядом с текстом',
      description:
        'Иконка-украшение: смысл несёт текст рядом. Скринридер иконку пропускает — без title и aria-label она помечена aria-hidden.',
      render: () => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <Icon iconName="Phone" size={16} />
          +7 900 000-00-00
        </span>
      ),
      code: `<span className="inline-flex items-center gap-1.5 text-sm">
  <Icon iconName="Phone" size={16} />
  +7 900 000-00-00
</span>`,
    },
    {
      id: 'meaningful',
      title: 'Иконка со смыслом',
      description:
        'Если иконка что-то значит сама по себе, дайте ей имя: title рисует <title> внутри <svg>, иконка получает role="img" и читается скринридером.',
      render: () => (
        <Icon iconName="BadgeCheck" size={20} title="Проверено" className="text-primary" />
      ),
      code: `<Icon iconName="BadgeCheck" size={20} title="Проверено" className="text-primary" />`,
    },
  ],
  props: [
    {
      name: 'iconName',
      type: 'string',
      default: "'Circle'",
      description:
        'Имя иконки lucide в PascalCase: House, ArrowRight, CircleCheck. Неизвестное имя — ничего не рисуется.',
    },
    {
      name: 'size',
      type: 'number',
      default: '24',
      description: 'Ширина и высота в пикселях.',
    },
    {
      name: 'color',
      type: 'string',
      default: "'currentColor'",
      description: 'Цвет линий — любой CSS-цвет. Без него иконка берёт цвет текста.',
    },
    {
      name: 'strokeWidth',
      type: 'number',
      default: '2',
      description: 'Толщина линий.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Классы <svg>: цвет (text-*), отступы.',
    },
    {
      name: 'title',
      type: 'string',
      description:
        'Имя иконки для скринридера: <title> внутри <svg> и role="img". Без title (и без aria-label / aria-labelledby) иконка декоративная — aria-hidden.',
    },
    {
      name: '...props',
      type: 'SVG-атрибуты lucide',
      description: 'style, aria-*, data-*, обработчики событий — доходят до <svg>.',
    },
  ],
};
