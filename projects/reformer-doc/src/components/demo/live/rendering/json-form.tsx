import { useState, type FormEvent } from 'react';
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { minLength, required } from '@reformer/core/validators';
import { FormRenderer } from '@reformer/renderer-react';
import { defineJsonSchema, defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Box, Button, FormField, Input, SelectAsync } from '@reformer/ui-kit';

type DeliveryForm = { name: string; delivery: string | null };

// Документ — чистые данные: тот же объект можно хранить в .json или получить с сервера.
// defineJsonSchema<T> проверяет пути $model(...) по типу формы: опечатка — ошибка компиляции.
const deliveryDocument = defineJsonSchema<DeliveryForm>({
  format: 2,
  root: {
    component: '$component(Box)',
    componentProps: { className: 'flex flex-col gap-4' },
    children: [
      {
        model: '$model(name)',
        component: '$component(Input)',
        componentProps: { label: 'Получатель' },
      },
      {
        model: '$model(delivery)',
        component: '$component(Select)',
        componentProps: {
          label: 'Доставка',
          placeholder: 'Выберите способ',
          options: '$dataSource(DELIVERY_TYPES)',
        },
      },
      // HTML-узел без регистрации: $model(...) в тексте обновляется при вводе.
      {
        component: '$html(p)',
        componentProps: { className: 'text-sm text-muted-foreground' },
        children: ['Получатель: ', '$model(name)'],
      },
    ],
  },
});

// Реестр связывает имена из документа с кодом: компонентами кита и данными.
const registry = defineRegistry((reg) => {
  reg.component('Box', Box);
  reg.component('Input', Input);
  reg.component('Select', SelectAsync); // имя в документе не обязано совпадать с экспортом
  reg.component(FIELD_WRAPPER, FormField); // обёртка каждого поля: подпись и замечания
  reg.dataSource('DELIVERY_TYPES', [
    { value: 'pickup', label: 'Самовывоз' },
    { value: 'courier', label: 'Курьер' },
  ]);
});

// Правила — код рядом с документом: в JSON их нет.
const deliveryRules = defineValidation<DeliveryForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.delivery, [required()]);
});

// Вместо запроса к серверу — задержка: пример работает прямо в браузере.
const sendOrder = (values: DeliveryForm) =>
  new Promise<DeliveryForm>((resolve) => setTimeout(() => resolve(values), 600));

export default function JsonFormExample() {
  // Та же сборка, что для схемы на TypeScript: вместо функции-схемы — документ и реестр.
  const order = useFormBundle(() =>
    createForm<DeliveryForm>({
      initial: { name: '', delivery: null },
      schema: deliveryDocument,
      registry,
      validation: deliveryRules,
    })
  );
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSentTo(null);
    // Одна проверка всех правил; обработчик вызывается, только если ошибок нет.
    const outcome = await order.submission.submit(sendOrder);
    if (outcome.status === 'submitted') setSentTo(outcome.result.name);
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      {/* Обёртку поля рендерер берёт из сборки: её положил туда реестр. */}
      <FormRenderer form={order} />
      <Button type="submit" className="self-start">
        Оформить
      </Button>
      {sentTo && <p className="text-sm">Заказ для {sentTo} принят.</p>}
    </form>
  );
}
