import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { compute, defineFormBehavior, enableWhen } from '@reformer/core/behaviors';
import { useFormBundle } from '@reformer/core/react';
import { FormField, Input, InputNumber } from '@reformer/ui-kit';

type Order = { price: number | null; quantity: number | null; total: number; promoCode: string };

const orderSchema = (model: FormModel<Order>): FormSchemaNode => ({
  children: [
    { model: model.$.price, component: InputNumber, componentProps: { label: 'Цена, ₽' } },
    { model: model.$.quantity, component: InputNumber, componentProps: { label: 'Количество' } },
    // Итог пишет поведение. Ключ узла disabled — поле только для чтения.
    {
      model: model.$.total,
      component: InputNumber,
      componentProps: { label: 'Итого, ₽' },
      disabled: true,
    },
    {
      model: model.$.promoCode,
      component: Input,
      componentProps: { label: 'Промокод — для заказа от 5000 ₽' },
    },
  ],
});

const orderBehavior = defineFormBehavior<Order>(({ model }) => {
  // Читает price и quantity — пересчитывается, когда меняется любое из них.
  compute(model.$.total, () => (model.price ?? 0) * (model.quantity ?? 0));
  // Промокод доступен только для крупного заказа; при выключении поле очищается.
  enableWhen(model.$.promoCode, () => model.total >= 5000, { resetOnDisable: true });
});

export default function OrderTotalExample() {
  const order = useFormBundle(() =>
    createForm<Order>({
      initial: { price: 1200, quantity: 1, total: 0, promoCode: '' },
      schema: orderSchema,
      behavior: orderBehavior,
    })
  );
  const { form } = order;

  return (
    <div className="flex max-w-md flex-col gap-4">
      <FormField control={form.price} />
      <FormField control={form.quantity} />
      <FormField control={form.total} />
      <FormField control={form.promoCode} />
    </div>
  );
}
