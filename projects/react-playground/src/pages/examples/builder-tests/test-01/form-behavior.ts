/**
 * Поведение формы «test-01» — реактивные связи над МОДЕЛЬЮ (вычисляемые поля, копирование,
 * доступность, ре-валидация). Docs: @reformer/core/behaviors.
 *
 * Ниже — активное поведение под поля model.ts + шпаргалка частых случаев (раскомментируйте нужное
 * вместе с его импортом).
 */
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
// Импорты для шпаргалки ниже — раскомментируйте то, что понадобится. Держать их подключёнными
// «на всякий случай» нельзя: проекты собираются с `noUnusedLocals`, и форма не скомпилируется.
// import { compute, copyFrom, syncFields, onChange, enableWhen, disableWhen, resetWhen, revalidateWhen } from '@reformer/core/behaviors';
import type { FormShape } from './model';

export const formBehavior = defineFormBehavior<FormShape>(({ model }) => {
  // ── Активное поведение ──
  // greeting вычисляется из name.
  computeFrom([model.$.name], model.$.greeting, (name) => (name ? `Привет, ${name}!` : ''));

  // ── Шпаргалка (скопируйте под свои поля) ──

  // Вычисляемое поле (авто-трекинг зависимостей внутри read):
  // compute(model.$.total, () => model.price * model.qty);

  // Вычисляемое из явного списка источников:
  // computeFrom([model.$.amount, model.$.rate, model.$.term], model.$.monthlyPayment,
  //   (amount, rate, term) => annuity(amount, rate, term));

  // Копирование значения (опционально по условию):
  // copyFrom(model.$.email, model.$.login);
  // copyFrom(model.$.legalAddress, model.$.actualAddress, { when: () => model.sameAddress });

  // Двусторонняя синхронизация (с трансформом):
  // syncFields(model.$.priceWithVat, model.$.priceNoVat, { transform: (v) => v / 1.2 });

  // Реакция на изменение (с debounce):
  // onChange(model.$.query, (value) => void search(value), { debounce: 300 });

  // Доступность поля по условию:
  // enableWhen(model.$.companyName, () => model.employmentStatus === 'employed');
  // disableWhen(model.$.promoCode, () => !model.hasPromo, { resetOnDisable: true });

  // Сброс поля при условии:
  // resetWhen(model.$.childrenCount, () => !model.hasChildren, { resetValue: 0 });

  // Ре-валидация зависимого поля (мост к валидации):
  // revalidateWhen([model.$.password], () => void validateModel(model, formValidation));
});
