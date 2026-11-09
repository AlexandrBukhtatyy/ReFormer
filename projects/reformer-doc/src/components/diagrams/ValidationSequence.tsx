import { translate } from '@docusaurus/Translate';
import { SequenceDiagram } from './SequenceDiagram';

/**
 * Как проходит проверка: стратегия выбирает момент, правила ставят замечания на ноду,
 * `FormField` показывает текст по коду.
 */
export function ValidationSequence() {
  return (
    <SequenceDiagram
      title={translate({ id: 'diagram.validation.title', message: 'Как проходит проверка' })}
      caption={translate({
        id: 'diagram.validation.caption',
        message:
          'Замечание несёт код и параметры, а текст подбирается только при показе. Пунктир — ответ.',
      })}
      participants={[
        {
          id: 'user',
          title: translate({ id: 'diagram.validation.user', message: 'Пользователь' }),
        },
        {
          id: 'strategy',
          title: translate({ id: 'diagram.validation.strategy', message: 'Стратегия' }),
          to: '/docs/validation/validation-strategies',
        },
        {
          id: 'rules',
          title: translate({ id: 'diagram.validation.rules', message: 'Правила' }),
          to: '/docs/core-concepts/schemas/validation-schema',
        },
        {
          id: 'node',
          title: translate({ id: 'diagram.validation.node', message: 'Нода поля' }),
          to: '/docs/core-concepts/nodes',
        },
        { id: 'field', title: 'FormField', to: '/docs/cdk/form-field' },
      ]}
      steps={[
        {
          from: 'user',
          to: 'strategy',
          label: translate({
            id: 'diagram.validation.trigger',
            message: 'ввод, уход из поля\nили отправка',
          }),
        },
        {
          from: 'strategy',
          to: 'rules',
          label: translate({
            id: 'diagram.validation.run',
            message: 'прогон правил\nпо значениям модели',
          }),
        },
        {
          from: 'rules',
          to: 'node',
          reply: true,
          label: translate({
            id: 'diagram.validation.issues',
            message: 'замечания\n{ code, params }',
          }),
        },
        { from: 'node', to: 'field', reply: true, label: 'issues,\nshouldShowIssues' },
        {
          from: 'field',
          to: 'user',
          reply: true,
          label: translate({
            id: 'diagram.validation.text',
            message: 'текст по коду из словаря',
          }),
        },
      ]}
    />
  );
}
