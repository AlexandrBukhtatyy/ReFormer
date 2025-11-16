import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../../../types/credit-application';

interface ConfirmationFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function ConfirmationForm({ control }: ConfirmationFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Подтверждение и согласия</h2>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Пожалуйста, внимательно ознакомьтесь с условиями и дайте необходимые согласия перед
            отправкой заявки.
          </p>
        </div>

        {control.monthlyPayment.value > 30000 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              <b>Внимание!</b> Ежемесячный платеж превышает 30 000 Руб.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Обязательные согласия</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div>
              <b>Процентная ставка:</b> {control.interestRate.value}
            </div>
            <span className="text-xs text-gray-500">
              зависит от типа кредита, региона, наличия имущества
            </span>
          </div>
          <div>
            <div>
              <b>Ежемесячный платеж:</b> {control.monthlyPayment.value}
            </div>
            <span className="text-xs text-gray-500">
              вычисляется по формуле аннуитетного платежа
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Обязательные согласия</h3>
        <div className="space-y-3">
          <FormField control={control.agreePersonalData} />
          <FormField control={control.agreeCreditHistory} />
          <FormField control={control.agreeTerms} />
          <FormField control={control.confirmAccuracy} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold mt-6">Опциональные согласия</h3>
        <FormField control={control.agreeMarketing} />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold mt-6">Электронная подпись</h3>
        <FormField control={control.electronicSignature} />
        <p className="text-xs text-gray-500">
          Введите код из SMS, отправленный на ваш номер телефона
        </p>
      </div>

      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mt-6">
        <p className="text-sm text-yellow-800">
          <strong>Внимание!</strong> После нажатия кнопки &quot;Отправить заявку&quot; вы
          подтверждаете достоверность предоставленной информации и согласие c условиями
          кредитования.
        </p>
      </div>

      <div className="p-4 bg-green-50 border border-green-200 rounded-md">
        <h4 className="font-semibold text-green-900 mb-2">Что будет дальше?</h4>
        <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
          <li>Ваша заявка будет рассмотрена в течение 24 часов</li>
          <li>Мы свяжемся c вами для подтверждения информации</li>
          <li>После одобрения вы получите индивидуальное предложение</li>
          <li>Вы сможете подписать договор онлайн или в офисе</li>
        </ul>
      </div>
    </div>
  );
}
