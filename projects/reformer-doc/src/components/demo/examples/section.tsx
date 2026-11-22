import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { Box, FormField, Input, Section } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Section — не поле формы, а контейнер `<section>` с необязательным заголовком. Variants —
 * секция в JSX с заголовком и без, Examples — секция как узел схемы формы, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */

type Passport = { series: string; number: string; issuedBy: string };

// Группа «Паспорт»: заголовок h3, внутри сетка из двух полей и поле на всю ширину.
const passportSchema = (model: FormModel<Passport>): FormSchemaNode => ({
  component: Section,
  componentProps: {
    title: 'Паспорт',
    titleAs: 'h3',
    titleClassName: 'text-lg font-semibold',
    className: 'space-y-4',
  },
  children: [
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        { model: model.$.series, component: Input, componentProps: { label: 'Серия' } },
        { model: model.$.number, component: Input, componentProps: { label: 'Номер' } },
      ],
    },
    { model: model.$.issuedBy, component: Input, componentProps: { label: 'Кем выдан' } },
  ],
});

function PassportFormExample() {
  const bundle = useFormBundle(() =>
    createForm<Passport>({
      initial: { series: '', number: '', issuedBy: '' },
      schema: passportSchema,
    })
  );
  return (
    <div style={{ width: '100%', maxWidth: 520 }}>
      <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}

export const sectionDocConfig: ComponentDocConfig = {
  name: 'Section',
  importFrom: '@reformer/ui-kit',
  description:
    'Контейнер <section> с необязательным заголовком: группа связанных полей формы. Уровень заголовка — titleAs.',
  variants: [
    {
      id: 'with-title',
      title: 'С заголовком группы',
      description:
        'title рисует заголовок, titleAs — его уровень (по умолчанию h3). Вес задаёт titleClassName, отступы — className.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Section
            title="Личные данные"
            titleAs="h3"
            titleClassName="text-lg font-semibold"
            className="space-y-4"
          >
            <Input placeholder="Имя" aria-label="Имя" />
            <Input placeholder="Фамилия" aria-label="Фамилия" />
          </Section>
        </div>
      ),
      code: `<Section
  title="Личные данные"
  titleAs="h3"
  titleClassName="text-lg font-semibold"
  className="space-y-4"
>
  <Input placeholder="Имя" aria-label="Имя" />
  <Input placeholder="Фамилия" aria-label="Фамилия" />
</Section>`,
    },
    {
      id: 'step-title',
      title: 'Заголовок шага (h2)',
      description:
        'Заголовок шага формы — titleAs="h2" и titleClassName="text-xl font-bold". Группы внутри шага — h3.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Section
            title="Шаг 1. Заявка"
            titleAs="h2"
            titleClassName="text-xl font-bold"
            className="space-y-4"
          >
            <Input placeholder="Сумма кредита" aria-label="Сумма кредита" />
          </Section>
        </div>
      ),
      code: `<Section
  title="Шаг 1. Заявка"
  titleAs="h2"
  titleClassName="text-xl font-bold"
  className="space-y-4"
>
  <Input placeholder="Сумма кредита" aria-label="Сумма кредита" />
</Section>`,
    },
    {
      id: 'no-title',
      title: 'Без заголовка',
      description: 'Без title Section рисует только <section> — обёртку с отступами.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Section className="space-y-4">
            <Input placeholder="Адрес" aria-label="Адрес" />
            <Input placeholder="Город" aria-label="Город" />
          </Section>
        </div>
      ),
      code: `<Section className="space-y-4">
  <Input placeholder="Адрес" aria-label="Адрес" />
  <Input placeholder="Город" aria-label="Город" />
</Section>`,
    },
  ],
  examples: [
    {
      id: 'schema-group',
      title: 'Группа полей в схеме формы',
      description:
        'Section с заголовком h3, внутри — Box с сеткой из двух полей и поле на всю ширину вне сетки.',
      render: PassportFormExample,
      code: `import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { Box, FormField, Input, Section } from '@reformer/ui-kit';

type Passport = { series: string; number: string; issuedBy: string };

const passportSchema = (model: FormModel<Passport>): FormSchemaNode => ({
  component: Section,
  componentProps: {
    title: 'Паспорт',
    titleAs: 'h3',
    titleClassName: 'text-lg font-semibold',
    className: 'space-y-4',
  },
  children: [
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        { model: model.$.series, component: Input, componentProps: { label: 'Серия' } },
        { model: model.$.number, component: Input, componentProps: { label: 'Номер' } },
      ],
    },
    { model: model.$.issuedBy, component: Input, componentProps: { label: 'Кем выдан' } },
  ],
});

function PassportForm() {
  const bundle = useFormBundle(() =>
    createForm<Passport>({
      initial: { series: '', number: '', issuedBy: '' },
      schema: passportSchema,
    })
  );
  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
}`,
    },
  ],
  props: [
    {
      name: 'title',
      type: 'string',
      description: 'Текст заголовка. Не задан — заголовка нет, остаётся только <section>.',
    },
    {
      name: 'titleAs',
      type: "'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'",
      default: "'h3'",
      description: 'Тег заголовка — его уровень в структуре страницы.',
    },
    {
      name: 'titleClassName',
      type: 'string',
      description:
        'Классы заголовка. Своих стилей у заголовка нет: вес задают здесь, например text-lg font-semibold.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Классы контейнера <section>: отступы и раскладка, например space-y-4.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Содержимое после заголовка. В схеме формы — массив children узла.',
    },
  ],
};
