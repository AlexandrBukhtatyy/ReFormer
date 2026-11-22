// base — DSL-контейнер `<section>` с опциональным заголовком (группировка полей в RenderSchema).
export { Section } from './variants/base/section-base';
export type { SectionProps } from './variants/base/section-base';

// props-схема (единственный вариант; DSL-контейнер без field/адаптера).
export { sectionBasePropsSchema } from './variants/base/section-base.props';
