import { ErrorState, LoadingState } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * State — не form-control: два ReFormer-специфичных блока-заглушки, которые показывают
 * вместо формы, пока грузятся данные (LoadingState) или когда загрузка провалилась (ErrorState).
 * Оба несут ARIA для скринридеров: LoadingState — role="status"/aria-live="polite",
 * ErrorState — role="alert"/aria-live="assertive". Variants — оба состояния, Examples — типовой
 * поток «загрузка → ошибка с повтором».
 */
export const stateDocConfig: ComponentDocConfig = {
  name: 'State',
  importFrom: '@reformer/ui-kit',
  description:
    'Заглушки состояний загрузки и ошибки для экрана формы. LoadingState — центрированный спиннер с подписью (role="status"); ErrorState — карточка ошибки с опциональной кнопкой «Повторить» (role="alert").',
  variants: [
    {
      id: 'loading',
      title: 'LoadingState — загрузка',
      description:
        'Центрированный спиннер с заголовком и подзаголовком. role="status" + aria-live="polite" — статус объявляется ненавязчиво.',
      render: () => <LoadingState />,
      code: `<LoadingState />

// с кастомными подписями:
<LoadingState title="Загружаем заявку…" subtitle="Это займёт пару секунд" />`,
    },
    {
      id: 'error-retry',
      title: 'ErrorState — ошибка с повтором',
      description:
        'Карточка ошибки с иконкой, заголовком и текстом. Если задан onRetry — рендерится кнопка «Повторить». role="alert" + aria-live="assertive" — ошибка объявляется сразу.',
      render: () => (
        <ErrorState
          error="Не удалось загрузить данные заявки"
          onRetry={() => window.location.reload()}
        />
      ),
      code: `<ErrorState
  error="Не удалось загрузить данные заявки"
  onRetry={() => window.location.reload()}
/>`,
    },
    {
      id: 'error-no-retry',
      title: 'ErrorState — без повтора',
      description: 'Без onRetry кнопка не рендерится — чистое сообщение об ошибке.',
      render: () => <ErrorState error="Заявка не найдена" title="Ничего не найдено" />,
      code: `<ErrorState error="Заявка не найдена" title="Ничего не найдено" />`,
    },
  ],
  examples: [
    {
      id: 'load-flow',
      title: 'Поток загрузки формы',
      description:
        'Типовое применение — по состоянию хука загрузки показать LoadingState, при ошибке ErrorState с повтором, иначе саму форму.',
      render: () => (
        <ErrorState error="Сервис временно недоступен" onRetry={() => window.location.reload()} />
      ),
      code: `const { isLoading, error } = useLoadCreditApplication(form, id);

if (isLoading) return <LoadingState />;
if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;

return <CreditApplicationForm form={form} />;`,
    },
  ],
  props: [
    {
      name: 'LoadingState.title',
      type: 'string',
      default: "'Загрузка данных...'",
      description: 'Основной текст под спиннером.',
    },
    {
      name: 'LoadingState.subtitle',
      type: 'string',
      default: "'Пожалуйста, подождите'",
      description: 'Вспомогательный текст.',
    },
    {
      name: 'ErrorState.error',
      type: 'string',
      description: 'Текст ошибки (обязателен), показывается под заголовком.',
    },
    {
      name: 'ErrorState.title',
      type: 'string',
      default: "'Ошибка загрузки'",
      description: 'Заголовок блока ошибки.',
    },
    {
      name: 'ErrorState.onRetry',
      type: '() => void',
      description: 'Колбэк повтора. Если задан — рендерится кнопка «Повторить».',
    },
    {
      name: 'ErrorState.retryLabel',
      type: 'string',
      default: "'Повторить'",
      description: 'Подпись кнопки повтора.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Внешний CSS-класс контейнера (заменяет дефолтный, не мёржится).',
    },
  ],
};
