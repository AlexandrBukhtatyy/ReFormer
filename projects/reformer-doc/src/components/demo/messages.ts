import { translate } from '@docusaurus/Translate';

/**
 * Строки интерфейса демо-компонентов сайта.
 *
 * Исходный язык — русский (локаль сайта по умолчанию), переводы — в `i18n/<locale>/code.json`
 * под теми же id; `npm run write-translations -- --locale en` находит их по вызовам `translate()`.
 *
 * Функции, а не константы: `translate()` читает переводы активной локали в момент вызова, и
 * вызов при импорте модуля отдал бы исходный текст на любой локали.
 */
export const demoText = {
  loading: () => translate({ id: 'demo.loading', message: 'Загрузка демо…' }),
  preview: () => translate({ id: 'demo.preview', message: 'Превью' }),
  code: () => translate({ id: 'demo.code', message: 'Код' }),
  codeFormat: () => translate({ id: 'demo.codeFormat', message: 'Формат кода' }),
  darkMode: () => translate({ id: 'demo.darkMode', message: 'Тёмная тема' }),
  background: () => translate({ id: 'demo.background', message: 'Фон' }),
  hint: () => translate({ id: 'demo.hint', message: 'Подсказка' }),
  resizeTitle: () =>
    translate({
      id: 'demo.resize.title',
      message: 'Потяните, чтобы изменить ширину превью. Двойной клик — сбросить.',
    }),
  resizeLabel: () => translate({ id: 'demo.resize.label', message: 'Изменить ширину превью' }),

  tabVariants: () => translate({ id: 'demo.tab.variants', message: 'Варианты' }),
  tabExamples: () => translate({ id: 'demo.tab.examples', message: 'Примеры' }),
  tabApi: () => translate({ id: 'demo.tab.api', message: 'API' }),
  tabsLabel: (name: string) =>
    translate({ id: 'demo.tabs.label', message: '{name}: документация' }, { name }),
  tabsHintLabel: () =>
    translate({
      id: 'demo.tabs.hint.label',
      message: 'В чём разница между вариантами и примерами',
    }),
  tabsHintVariants: () =>
    translate({
      id: 'demo.tabs.hint.variants',
      message:
        'готовые конфигурации компонента: один и тот же компонент с разными пропсами. Витрина состояний — например, обычный Select и Select с расширенной информацией.',
    }),
  tabsHintExamples: () =>
    translate({
      id: 'demo.tabs.hint.examples',
      message:
        'приёмы в коде: как решить задачу. Например, как разные источники данных работают с компонентом.',
    }),
  noPlayground: () =>
    translate({
      id: 'demo.noPlayground',
      message: 'Для этого компонента нет интерактивного примера.',
    }),

  propsName: () => translate({ id: 'demo.props.name', message: 'Проп' }),
  propsType: () => translate({ id: 'demo.props.type', message: 'Тип' }),
  propsDefault: () => translate({ id: 'demo.props.default', message: 'По умолчанию' }),
  propsDescription: () => translate({ id: 'demo.props.description', message: 'Описание' }),

  value: () => translate({ id: 'demo.api.value', message: 'Значение' }),
  formData: () => translate({ id: 'demo.api.formData', message: 'Данные формы' }),
  reset: () => translate({ id: 'demo.api.reset', message: 'Сбросить' }),
  submit: () => translate({ id: 'demo.api.submit', message: 'Отправить' }),
  valid: () => translate({ id: 'demo.api.valid', message: '✅ ошибок нет' }),
  invalid: () => translate({ id: 'demo.api.invalid', message: '❌ есть ошибки' }),
};
