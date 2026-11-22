// @reformer-form-build 90e884f8f90954eb собран сервером ReFormer из form.intent.json: форму меняют через сервер (form_build; в guided — form_start, затем form_edit), а не этот файл — правка руками отсоединит его от сборки, guided её отменит
/**
 * Поток шагов формы «Оформление заказа»: идентификатор шага — `selector` узла шага в схеме,
 * `next()` потока проверяет правила текущего шага.
 * Подключение: createForm({ …, flow: formFlow }).
 */
import type { FormFlowConfig } from '@reformer/core';
import { pokupatelRules, companyRules, dostavkaRules, tovaryRules, oplataRules, podtverzhdenieRules } from './form.validation';
import type { OformlenieZakazaShape } from './model';

export const formFlow: FormFlowConfig<OformlenieZakazaShape> = {
  steps: [
    { id: 'pokupatel', rules: pokupatelRules },
    { id: 'company', rules: companyRules },
    { id: 'dostavka', rules: dostavkaRules },
    { id: 'tovary', rules: tovaryRules },
    { id: 'oplata', rules: oplataRules },
    { id: 'podtverzhdenie', rules: podtverzhdenieRules },
  ],
};
