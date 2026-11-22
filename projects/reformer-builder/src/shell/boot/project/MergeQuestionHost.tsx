/**
 * Диалог вопроса о расхождении — отрисовка очереди из `./merge-flow`.
 *
 * Диалог знает, как показать три стороны и принять выбор; очередь знает, о чём спросить
 * и что сделать с ответом. Здесь они встречаются: вопрос есть — диалог открыт.
 *
 * Стоит рядом с оболочкой, а не внутри неё: вопрос принадлежит открытому проекту, а проект
 * оболочке приходит снаружи — её платформенная часть ни сессии, ни слияния не знает.
 *
 * @module shell/boot/project/MergeQuestionHost
 */

import { useCallback, useSyncExternalStore, type ReactElement } from 'react';
import type { I18nService } from '@/shell/platform/services/i18n/i18n';
import { MergeDialog } from '@/shell/platform/ui/dialogs/MergeDialog';
import type { MergeFlow } from './merge-flow';

export interface MergeQuestionHostProps {
  readonly flow: MergeFlow;
  readonly i18n: I18nService;
}

export function MergeQuestionHost({ flow, i18n }: MergeQuestionHostProps): ReactElement | null {
  const subscribe = useCallback(
    (listener: () => void) => {
      const subscription = flow.subscribe(listener);
      return () => {
        subscription.dispose();
      };
    },
    [flow]
  );
  const question = useSyncExternalStore(subscribe, flow.get, flow.get);

  if (question === null) return null;
  return (
    <MergeDialog
      open
      name={question.name}
      path={question.path}
      sides={question.sides}
      plan={question.plan}
      problem={question.problem}
      i18n={i18n}
      onCancel={() => {
        flow.cancel();
      }}
      onResolve={(choice, text) => {
        void flow.answer(choice, text);
      }}
    />
  );
}
