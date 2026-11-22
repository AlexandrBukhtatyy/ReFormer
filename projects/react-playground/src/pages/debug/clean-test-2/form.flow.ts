// @reformer-form-build 8cc4da455f47fb96 собран из form.intent.json; правка руками отсоединит файл от сборки
/**
 * Поток шагов формы «Заявка на кредит»: идентификатор шага — `selector` узла шага в схеме,
 * `next()` потока проверяет правила текущего шага.
 * Подключение: createForm({ …, flow: formFlow }).
 */
import type { FormFlowConfig } from '@reformer/core';
import { s1Rules, s2Rules, s3Rules, s4Rules, s5Rules, s6Rules } from './form.validation';
import type { CreditApplication } from './model';

export const formFlow: FormFlowConfig<CreditApplication> = {
  steps: [
    { id: 's1', rules: s1Rules },
    { id: 's2', rules: s2Rules },
    { id: 's3', rules: s3Rules },
    { id: 's4', rules: s4Rules },
    { id: 's5', rules: s5Rules },
    { id: 's6', rules: s6Rules },
  ],
};
