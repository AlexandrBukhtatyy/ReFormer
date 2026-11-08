import { useState } from 'react';
import { createForm, type FormGroup, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, max, min, minLength, required } from '@reformer/core/validators';
import {
  CheckboxWithLabel,
  FormField,
  FormWizard,
  Input,
  InputNumber,
  RadioGroupOptions,
  type FormWizardStep,
} from '@reformer/ui-kit';

type Ticket = {
  name: string;
  email: string;
  format: string | null;
  seats: number | null;
  agree: boolean;
};

const FORMATS = [
  { value: 'online', label: 'Онлайн' },
  { value: 'hall', label: 'В зале' },
];

// Схема описывает поля всех шагов; по шагам их раскладывают тела шагов ниже.
const ticketSchema = (model: FormModel<Ticket>): FormSchemaNode => ({
  children: [
    { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
    { model: model.$.email, component: Input, componentProps: { label: 'Email', type: 'email' } },
    {
      model: model.$.format,
      component: RadioGroupOptions,
      componentProps: { label: 'Формат', options: FORMATS },
    },
    {
      model: model.$.seats,
      component: InputNumber,
      componentProps: { label: 'Сколько мест (до 5)', min: 1 },
    },
    {
      model: model.$.agree,
      component: CheckboxWithLabel,
      componentProps: { label: 'Согласен с правилами мероприятия' },
    },
  ],
});

// У каждого шага свои правила: «Далее» проверяет только правила текущего шага.
const contactsRules = defineValidation<Ticket>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});
const ticketRules = defineValidation<Ticket>(({ model }) => {
  validate(model.$.format, [required()]);
  validate(model.$.seats, [required(), min(1), max(5)]);
});
const confirmRules = defineValidation<Ticket>(({ model }) => {
  validate(model.$.agree, [required()]); // у флажка «обязательно» значит «отмечен»
});

const createTicketForm = () =>
  createForm<Ticket>({
    initial: { name: '', email: '', format: null, seats: 1, agree: false },
    schema: ticketSchema,
    // Поток шагов: порядок шагов и правила каждого. Отправка проверит правила всех шагов.
    flow: {
      steps: [
        { id: 'contacts', rules: contactsRules },
        { id: 'ticket', rules: ticketRules },
        { id: 'confirm', rules: confirmRules },
      ],
    },
  });

// Тело шага получает корневую группу формы и рисует поля своего шага.
const ContactsStep = ({ control }: { control: FormGroup<Ticket> }) => (
  <div className="flex flex-col gap-4">
    <FormField control={control.name} />
    <FormField control={control.email} />
  </div>
);
const TicketStep = ({ control }: { control: FormGroup<Ticket> }) => (
  <div className="flex flex-col gap-4">
    <FormField control={control.format} />
    <FormField control={control.seats} />
  </div>
);
const ConfirmStep = ({ control }: { control: FormGroup<Ticket> }) => (
  <FormField control={control.agree} />
);

// Порядок записей — порядок шагов потока: STEPS[i] рисует шаг flow.steps[i].
const STEPS: FormWizardStep<Ticket>[] = [
  { number: 1, title: 'Контакты', body: ContactsStep },
  { number: 2, title: 'Билет', body: TicketStep },
  { number: 3, title: 'Подтверждение', body: ConfirmStep },
];

// Вместо запроса к серверу — задержка: пример работает прямо в браузере.
const sendTicket = (values: Ticket) =>
  new Promise<string>((resolve) =>
    setTimeout(() => resolve(`${values.name}, мест: ${values.seats}`), 600)
  );

export default function TicketWizardExample() {
  const ticket = useFormBundle(createTicketForm);
  const [booked, setBooked] = useState<string | null>(null);

  // Визард рисуется вне сборки, поэтому отправку проверяет сама страница:
  // submission.submit прогоняет правила всех шагов и зовёт обработчик, только если ошибок нет.
  const handleSubmit = async () => {
    setBooked(null);
    const outcome = await ticket.submission.submit(sendTicket);
    if (outcome.status === 'submitted') {
      setBooked(outcome.result);
      ticket.form.reset();
      ticket.flow?.reset(); // снова первый шаг, пройденные шаги забыты
    }
  };

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <FormWizard
        form={ticket.form}
        flow={ticket.flow}
        steps={STEPS}
        onSubmit={handleSubmit}
        submitLabel="Забронировать"
      />
      {booked && <p className="text-sm">Забронировано: {booked}</p>}
    </div>
  );
}
