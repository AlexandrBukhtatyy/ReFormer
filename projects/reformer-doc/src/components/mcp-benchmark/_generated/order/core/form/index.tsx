import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { formBehavior } from './form.behavior';
import { formSchema } from './form.schema';
import { formValidation } from './form.validation';
import { createFormModel, type OformlenieZakazaShape } from './model';
import { Button, FieldArraySection, FormField, Section } from '@reformer/ui-kit';
import type { FormGroup } from '@reformer/core';
import type { ItemsItem, RecipientsItem } from './model';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { formMessages } from './form.messages';
import { submitOrder } from './api';

// Markup written by form_edit {"op":"markup"}.
function ItemsRow({ control }: { control: FormGroup<ItemsItem> }) {
  return (
    <>
      <FormField control={control.title} />
      <FormField control={control.quantity} />
      <FormField control={control.price} />
      <FormField control={control.lineTotal} />
    </>
  );
}
function RecipientsRow({ control }: { control: FormGroup<RecipientsItem> }) {
  return (
    <>
      <FormField control={control.email} />
      <FormField control={control.primary} />
    </>
  );
}

export function OformlenieZakazaForm() {
  // Фабрика выполняется один раз: `useMemo` здесь неверен — React вправе сбросить кэш.
  const bundle = useFormBundle(() =>
    createForm<OformlenieZakazaShape>({
      model: createFormModel(),
      schema: formSchema,
      behavior: formBehavior,
      validation: formValidation,
    })
  );

  return (
    <ValidationMessagesProvider messages={formMessages}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void bundle.submission.submit(submitOrder);
          }}
        >
            <Section title="Покупатель">
              <FormField control={bundle.form.customerType} />
              <FormField control={bundle.form.contact.lastName} />
              <FormField control={bundle.form.contact.firstName} />
              <FormField control={bundle.form.email} />
              <FormField control={bundle.form.phone} />
              <FormField control={bundle.form.birthDate} />
            </Section>
            <Section title="Компания">
              <FormField control={bundle.form.company.name} />
              <FormField control={bundle.form.company.inn} />
            </Section>
            <Section title="Доставка">
              <FormField control={bundle.form.deliveryMethod} />
              <FormField control={bundle.form.deliveryAddress.city} />
              <FormField control={bundle.form.deliveryAddress.street} />
              <FormField control={bundle.form.deliveryAddress.house} />
              <FormField control={bundle.form.deliveryDate} />
              <FormField control={bundle.form.billingSame} />
              <FormField control={bundle.form.billingAddress.city} />
              <FormField control={bundle.form.billingAddress.street} />
              <FormField control={bundle.form.billingAddress.house} />
            </Section>
            <Section title="Товары">
              <FieldArraySection control={bundle.form.items} itemComponent={ItemsRow} title="Товары" />
              <FormField control={bundle.form.subtotal} />
            </Section>
            <Section title="Оплата">
              <FormField control={bundle.form.promoCode} />
              <FormField control={bundle.form.discount} />
              <FormField control={bundle.form.total} />
              <FormField control={bundle.form.paymentMethod} />
              <FormField control={bundle.form.receiptEmail} />
              <FormField control={bundle.form.comment} />
            </Section>
            <Section title="Подтверждение">
              <FieldArraySection control={bundle.form.recipients} itemComponent={RecipientsRow} title="Кому отправлять уведомления" />
              <FormField control={bundle.form.agreeTerms} />
              <FormField control={bundle.form.newsletter} />
              <FormField control={bundle.form.sources} />
            </Section>
            <Button type="submit">Оформить заказ</Button>
        </form>
    </ValidationMessagesProvider>
  );
}
