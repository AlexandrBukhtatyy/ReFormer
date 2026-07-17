import { Section } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/** Плейсхолдер-поле для превью (Section — контейнер, поля рисуем условно). */
function FieldStub({ label }: { label: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--ifm-color-emphasis-300)',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 13,
        color: 'var(--ifm-color-emphasis-700)',
      }}
    >
      {label}
    </div>
  );
}

/**
 * Section — не form-control, а DSL-контейнер `<section>`: группирует связанные поля с
 * опциональным заголовком. Таб Variants показывает пресеты (с заголовком / без, уровни h1-h6),
 * Examples — приёмы (сетка колонок, вложенность), API — таблица props.
 */
export const sectionDocConfig: ComponentDocConfig = {
  name: 'Section',
  importFrom: '@reformer/ui-kit',
  description:
    'Семантический <section>-контейнер для группировки связанных полей формы с опциональным заголовком (titleAs управляет уровнем h1-h6). DSL-контейнер — без seam, без field-версии.',
  variants: [
    {
      id: 'with-title',
      title: 'С заголовком',
      description: 'title рендерит заголовок; titleAs задаёт уровень (по умолчанию h3).',
      render: () => (
        <Section title="Личные данные" titleAs="h3" titleClassName="text-lg font-semibold">
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <FieldStub label="Имя" />
            <FieldStub label="Фамилия" />
          </div>
        </Section>
      ),
      code: `<Section title="Личные данные" titleAs="h3" titleClassName="text-lg font-semibold">
  {/* поля секции */}
</Section>`,
    },
    {
      id: 'no-title',
      title: 'Без заголовка',
      description:
        'Без title — только семантическая обёртка (группировка + отступы через className).',
      render: () => (
        <Section className="space-y-2">
          <div style={{ display: 'grid', gap: 8 }}>
            <FieldStub label="Адрес" />
            <FieldStub label="Город" />
          </div>
        </Section>
      ),
      code: `<Section className="space-y-2">
  {/* поля секции */}
</Section>`,
    },
  ],
  examples: [
    {
      id: 'grid-columns',
      title: 'Сетка из двух колонок',
      description: 'className управляет раскладкой контейнера — напр. grid grid-cols-2 gap-4.',
      render: () => (
        <Section title="Контакты" titleAs="h2" titleClassName="text-xl font-bold">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <FieldStub label="Телефон" />
            <FieldStub label="Email" />
          </div>
        </Section>
      ),
      code: `{
  component: Section,
  componentProps: {
    title: 'Контакты',
    titleAs: 'h2',
    titleClassName: 'text-xl font-bold',
    className: 'grid grid-cols-2 gap-4',
  },
  children: [
    { value: model.$.phone, component: Input },
    { value: model.$.email, component: Input },
  ],
}`,
    },
    {
      id: 'title-level',
      title: 'Уровень заголовка (h1-h6)',
      description:
        'titleAs выбирает семантический тег — важно для доступности и структуры документа.',
      render: () => (
        <div style={{ display: 'grid', gap: 16 }}>
          <Section title="Шаг 1. Заявка" titleAs="h2" titleClassName="text-xl font-bold">
            <FieldStub label="Сумма" />
          </Section>
          <Section title="Дополнительно" titleAs="h4" titleClassName="text-base font-semibold">
            <FieldStub label="Комментарий" />
          </Section>
        </div>
      ),
      code: `<Section title="Шаг 1. Заявка" titleAs="h2">…</Section>
<Section title="Дополнительно" titleAs="h4">…</Section>`,
    },
  ],
  props: [
    {
      name: 'title',
      type: 'string',
      description: 'Заголовок секции. Не задан — заголовок не рендерится (только обёртка).',
    },
    {
      name: 'titleAs',
      type: "'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'",
      default: 'h3',
      description: 'HTML-элемент заголовка (уровень h1-h6).',
    },
    {
      name: 'titleClassName',
      type: 'string',
      description: 'Доп. CSS-класс заголовка.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. CSS-класс контейнера <section> (напр. grid grid-cols-2 gap-4).',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Дочерние элементы (в DSL — массив child-нод листа, не componentProps).',
    },
  ],
};
