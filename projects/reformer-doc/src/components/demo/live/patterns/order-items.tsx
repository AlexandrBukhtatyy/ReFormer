import { useState, type FormEvent } from 'react';
import { arrayOf, createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useArrayLength, useFormBundle } from '@reformer/core/react';
import { applyEach, defineValidation, validate } from '@reformer/core/validation';
import { min, required } from '@reformer/core/validators';
import { Button, FormField, Input, InputNumber } from '@reformer/ui-kit';

type Item = { title: string; amount: number | null };
type Order = { items: Item[] };

// Шаблон новой строки: его получает push() без аргумента.
const blankItem = (): Item => ({ title: '', amount: null });

// Разметка одной строки: row — под-модель строки.
const itemRow = (row: FormModel<Item>): FormSchemaNode => ({
  children: [
    { model: row.$.title, component: Input, componentProps: { label: 'Позиция' } },
    { model: row.$.amount, component: InputNumber, componentProps: { label: 'Сумма, ₽' } },
  ],
});

// Узел массива: item строит разметку каждой строки. Рисуем строки сами — компонент не нужен.
const orderSchema = (model: FormModel<Order>): FormSchemaNode => ({
  children: [{ model: model.$.items, item: itemRow }],
});

// Правила одной строки — обычная схема валидации над типом строки.
const itemRules = defineValidation<Item>(({ model }) => {
  validate(model.$.title, [required()]);
  validate(model.$.amount, [required(), min(1)]);
});

const orderRules = defineValidation<Order>(({ model }) => {
  applyEach(model.$.items, itemRules); // к каждой строке, в том числе добавленной позже
});

const sendOrder = (values: Order) =>
  new Promise<Order>((resolve) => setTimeout(() => resolve(values), 500));

export default function OrderItemsExample() {
  const order = useFormBundle(() =>
    createForm<Order>({
      initial: { items: arrayOf(blankItem, [{ title: 'Ноутбук', amount: 90000 }]) },
      schema: orderSchema,
      validation: orderRules,
    })
  );
  const { items } = order.form;
  // Перерисовка на добавление и удаление строк.
  const count = useArrayLength(items);
  const [sent, setSent] = useState<number | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSent(null);
    const outcome = await order.submission.submit(sendOrder);
    if (outcome.status === 'submitted') setSent(outcome.result.items.length);
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-3">
      {items.map((row, index) => (
        // keyAt — ключ строки, а не индекс: состояние строки не переезжает к соседу.
        <div key={items.keyAt(index)} className="flex flex-col gap-3 rounded-md border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField control={row.title} />
            <FormField control={row.amount} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => items.removeAt(index)}
          >
            Удалить
          </Button>
        </div>
      ))}
      {count === 0 && <p className="text-sm">Позиций нет.</p>}
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => items.push()}>
          Добавить позицию
        </Button>
        <Button type="submit">Отправить</Button>
      </div>
      {sent !== null && <p className="text-sm">Отправлено позиций: {sent}.</p>}
    </form>
  );
}
