import { useState, type FormEvent } from 'react';
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, minLength, required } from '@reformer/core/validators';
import { Button, FormField, Input, Textarea } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string; message: string };

// Схема: какие поля есть и каким компонентом каждое рисуется.
const contactSchema = (model: FormModel<ContactForm>): FormSchemaNode => ({
  children: [
    { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
    { model: model.$.email, component: Input, componentProps: { label: 'Email', type: 'email' } },
    { model: model.$.message, component: Textarea, componentProps: { label: 'Сообщение' } },
  ],
});

// Правила — отдельно от разметки и константой модуля, а не внутри компонента.
const contactValidation = defineValidation<ContactForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.message, [required(), minLength(10)]);
});

// Вместо запроса к серверу — задержка: пример работает прямо в браузере.
const sendContact = (values: ContactForm) =>
  new Promise<ContactForm>((resolve) => setTimeout(() => resolve(values), 600));

export default function ContactFormExample() {
  const contact = useFormBundle(() =>
    createForm<ContactForm>({
      initial: { name: '', email: '', message: '' },
      schema: contactSchema,
      validation: contactValidation,
    })
  );
  const { form } = contact;
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSentTo(null);
    // Одна проверка всех правил; обработчик вызывается, только если ошибок нет.
    const outcome = await contact.submission.submit(sendContact);
    if (outcome.status === 'submitted') {
      setSentTo(outcome.result.name);
      // Чистый старт: значения — к исходным, касания и замечания полей сняты.
      form.reset();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <FormField control={form.name} />
      <FormField control={form.email} />
      <FormField control={form.message} />
      <Button type="submit" className="self-start">
        Отправить
      </Button>
      {sentTo && <p className="text-sm">Готово, {sentTo}! Форма очищена.</p>}
    </form>
  );
}
