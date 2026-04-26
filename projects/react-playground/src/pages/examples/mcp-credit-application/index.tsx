import { useArrayLength, useFormControl } from '@reformer/core';
import type { FormProxy, FieldNode } from '@reformer/core';
import type {
  AddressForm,
  PersonalDataForm,
  PassportDataForm,
  Step1LoanInfo,
  Step2PersonalData,
  Step3ContactInfo,
  Step4Employment,
  Step5Additional,
  Step6Confirmation,
  PropertyItem,
  ExistingLoanItem,
  CoBorrowerItem,
} from './types';
import { creditApplicationForm } from './schema';

// ─── Sub-form field components ──────────────────────────────────────────────

function PersonalDataFields({ form }: { form: FormProxy<PersonalDataForm> }) {
  const lastName   = useFormControl(form.lastName   as FieldNode<string>);
  const firstName  = useFormControl(form.firstName  as FieldNode<string>);
  const middleName = useFormControl(form.middleName as FieldNode<string>);
  const birthDate  = useFormControl(form.birthDate  as FieldNode<string>);
  const gender     = useFormControl(form.gender     as FieldNode<string>);
  const birthPlace = useFormControl(form.birthPlace as FieldNode<string>);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label>
        Фамилия
        <input value={lastName.value ?? ''} onChange={(e) => form.lastName.setValue(e.target.value)} disabled={lastName.disabled} />
      </label>
      <label>
        Имя
        <input value={firstName.value ?? ''} onChange={(e) => form.firstName.setValue(e.target.value)} disabled={firstName.disabled} />
      </label>
      <label>
        Отчество
        <input value={middleName.value ?? ''} onChange={(e) => form.middleName.setValue(e.target.value)} disabled={middleName.disabled} />
      </label>
      <label>
        Дата рождения
        <input type="date" value={birthDate.value ?? ''} onChange={(e) => form.birthDate.setValue(e.target.value)} disabled={birthDate.disabled} />
      </label>
      <label>
        Пол
        <select value={gender.value ?? 'male'} onChange={(e) => form.gender.setValue(e.target.value)} disabled={gender.disabled}>
          <option value="male">Мужской</option>
          <option value="female">Женский</option>
        </select>
      </label>
      <label>
        Место рождения
        <input value={birthPlace.value ?? ''} onChange={(e) => form.birthPlace.setValue(e.target.value)} disabled={birthPlace.disabled} />
      </label>
    </div>
  );
}

function PassportDataFields({ form }: { form: FormProxy<PassportDataForm> }) {
  const series         = useFormControl(form.series         as FieldNode<string>);
  const number         = useFormControl(form.number         as FieldNode<string>);
  const issueDate      = useFormControl(form.issueDate      as FieldNode<string>);
  const issuedBy       = useFormControl(form.issuedBy       as FieldNode<string>);
  const departmentCode = useFormControl(form.departmentCode as FieldNode<string>);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label>
        Серия
        <input value={series.value ?? ''} onChange={(e) => form.series.setValue(e.target.value)} disabled={series.disabled} />
      </label>
      <label>
        Номер
        <input value={number.value ?? ''} onChange={(e) => form.number.setValue(e.target.value)} disabled={number.disabled} />
      </label>
      <label>
        Дата выдачи
        <input type="date" value={issueDate.value ?? ''} onChange={(e) => form.issueDate.setValue(e.target.value)} disabled={issueDate.disabled} />
      </label>
      <label>
        Кем выдан
        <input value={issuedBy.value ?? ''} onChange={(e) => form.issuedBy.setValue(e.target.value)} disabled={issuedBy.disabled} />
      </label>
      <label>
        Код подразделения
        <input value={departmentCode.value ?? ''} onChange={(e) => form.departmentCode.setValue(e.target.value)} disabled={departmentCode.disabled} />
      </label>
    </div>
  );
}

function AddressFields({ form, label }: { form: FormProxy<AddressForm>; label: string }) {
  const region     = useFormControl(form.region     as FieldNode<string>);
  const city       = useFormControl(form.city       as FieldNode<string>);
  const street     = useFormControl(form.street     as FieldNode<string>);
  const house      = useFormControl(form.house      as FieldNode<string>);
  const apartment  = useFormControl(form.apartment  as FieldNode<string>);
  const postalCode = useFormControl(form.postalCode as FieldNode<string>);

  return (
    <fieldset>
      <legend>{label}</legend>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>Регион <input value={region.value ?? ''} onChange={(e) => form.region.setValue(e.target.value)} disabled={region.disabled} /></label>
        <label>Город <input value={city.value ?? ''} onChange={(e) => form.city.setValue(e.target.value)} disabled={city.disabled} /></label>
        <label>Улица <input value={street.value ?? ''} onChange={(e) => form.street.setValue(e.target.value)} disabled={street.disabled} /></label>
        <label>Дом <input value={house.value ?? ''} onChange={(e) => form.house.setValue(e.target.value)} disabled={house.disabled} /></label>
        <label>Квартира <input value={apartment.value ?? ''} onChange={(e) => form.apartment.setValue(e.target.value)} disabled={apartment.disabled} /></label>
        <label>Индекс <input value={postalCode.value ?? ''} onChange={(e) => form.postalCode.setValue(e.target.value)} disabled={postalCode.disabled} /></label>
      </div>
    </fieldset>
  );
}

// ─── Step sections ──────────────────────────────────────────────────────────

function Step1Section({ form }: { form: FormProxy<Step1LoanInfo> }) {
  const loanType       = useFormControl(form.loanType       as FieldNode<string>);
  const loanAmount     = useFormControl(form.loanAmount     as FieldNode<number | null>);
  const loanTerm       = useFormControl(form.loanTerm       as FieldNode<number>);
  const loanPurpose    = useFormControl(form.loanPurpose    as FieldNode<string>);
  const propertyValue  = useFormControl(form.propertyValue  as FieldNode<number | null>);
  const initialPayment = useFormControl(form.initialPayment as FieldNode<number | null>);
  const carBrand       = useFormControl(form.carBrand       as FieldNode<string | null>);
  const carModel       = useFormControl(form.carModel       as FieldNode<string | null>);
  const carYear        = useFormControl(form.carYear        as FieldNode<number | null>);
  const carPrice       = useFormControl(form.carPrice       as FieldNode<number | null>);

  return (
    <section>
      <h2>Шаг 1: Основная информация о кредите</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>
          Тип кредита
          <select value={loanType.value ?? 'consumer'} onChange={(e) => form.loanType.setValue(e.target.value)} disabled={loanType.disabled}>
            <option value="consumer">Потребительский</option>
            <option value="mortgage">Ипотека</option>
            <option value="car">Автокредит</option>
            <option value="business">Бизнес</option>
            <option value="refinancing">Рефинансирование</option>
          </select>
        </label>
        <label>
          Сумма кредита (₽)
          <input type="number" value={loanAmount.value ?? ''} onChange={(e) => form.loanAmount.setValue(e.target.value === '' ? null : Number(e.target.value))} disabled={loanAmount.disabled} />
        </label>
        <label>
          Срок кредита (месяцев)
          <input type="number" value={loanTerm.value ?? ''} onChange={(e) => form.loanTerm.setValue(Number(e.target.value))} disabled={loanTerm.disabled} />
        </label>
        <label>
          Цель кредита
          <textarea value={loanPurpose.value ?? ''} onChange={(e) => form.loanPurpose.setValue(e.target.value)} disabled={loanPurpose.disabled} />
        </label>
        <label>
          Стоимость недвижимости (₽)
          <input type="number" value={propertyValue.value ?? ''} onChange={(e) => form.propertyValue.setValue(e.target.value === '' ? null : Number(e.target.value))} disabled={propertyValue.disabled} />
        </label>
        <label>
          Первоначальный взнос (₽)
          <input type="number" value={initialPayment.value ?? ''} onChange={(e) => form.initialPayment.setValue(e.target.value === '' ? null : Number(e.target.value))} disabled={initialPayment.disabled} />
        </label>
        <label>
          Марка автомобиля
          <input value={carBrand.value ?? ''} onChange={(e) => form.carBrand.setValue(e.target.value || null)} disabled={carBrand.disabled} />
        </label>
        <label>
          Модель автомобиля
          <input value={carModel.value ?? ''} onChange={(e) => form.carModel.setValue(e.target.value || null)} disabled={carModel.disabled} />
        </label>
        <label>
          Год выпуска
          <input type="number" value={carYear.value ?? ''} onChange={(e) => form.carYear.setValue(e.target.value === '' ? null : Number(e.target.value))} disabled={carYear.disabled} />
        </label>
        <label>
          Стоимость автомобиля (₽)
          <input type="number" value={carPrice.value ?? ''} onChange={(e) => form.carPrice.setValue(e.target.value === '' ? null : Number(e.target.value))} disabled={carPrice.disabled} />
        </label>
      </div>
    </section>
  );
}

function Step2Section({ form }: { form: FormProxy<Step2PersonalData> }) {
  const inn   = useFormControl(form.inn   as FieldNode<string>);
  const snils = useFormControl(form.snils as FieldNode<string>);

  return (
    <section>
      <h2>Шаг 2: Персональные данные</h2>
      <fieldset>
        <legend>Личные данные</legend>
        <PersonalDataFields form={form.personalData} />
      </fieldset>
      <fieldset>
        <legend>Паспортные данные</legend>
        <PassportDataFields form={form.passportData} />
      </fieldset>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>ИНН <input value={inn.value ?? ''} onChange={(e) => form.inn.setValue(e.target.value)} disabled={inn.disabled} /></label>
        <label>СНИЛС <input value={snils.value ?? ''} onChange={(e) => form.snils.setValue(e.target.value)} disabled={snils.disabled} /></label>
      </div>
    </section>
  );
}

function Step3Section({ form }: { form: FormProxy<Step3ContactInfo> }) {
  const phoneMain          = useFormControl(form.phoneMain          as FieldNode<string>);
  const phoneAdditional    = useFormControl(form.phoneAdditional    as FieldNode<string | null>);
  const emailCtrl          = useFormControl(form.email              as FieldNode<string>);
  const emailAdditional    = useFormControl(form.emailAdditional    as FieldNode<string | null>);
  const sameAsRegistration = useFormControl(form.sameAsRegistration as FieldNode<boolean>);

  return (
    <section>
      <h2>Шаг 3: Контактная информация</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>Основной телефон <input value={phoneMain.value ?? ''} onChange={(e) => form.phoneMain.setValue(e.target.value)} disabled={phoneMain.disabled} /></label>
        <label>Дополнительный телефон <input value={phoneAdditional.value ?? ''} onChange={(e) => form.phoneAdditional.setValue(e.target.value || null)} disabled={phoneAdditional.disabled} /></label>
        <label>Email <input type="email" value={emailCtrl.value ?? ''} onChange={(e) => form.email.setValue(e.target.value)} disabled={emailCtrl.disabled} /></label>
        <label>Дополнительный Email <input type="email" value={emailAdditional.value ?? ''} onChange={(e) => form.emailAdditional.setValue(e.target.value || null)} disabled={emailAdditional.disabled} /></label>
        <label>
          <input type="checkbox" checked={sameAsRegistration.value ?? true} onChange={(e) => form.sameAsRegistration.setValue(e.target.checked)} disabled={sameAsRegistration.disabled} />
          Адрес проживания совпадает с адресом регистрации
        </label>
      </div>
      <AddressFields form={form.registrationAddress} label="Адрес регистрации" />
      <AddressFields form={form.residenceAddress} label="Адрес проживания" />
    </section>
  );
}

function Step4Section({ form }: { form: FormProxy<Step4Employment> }) {
  const employmentStatus       = useFormControl(form.employmentStatus       as FieldNode<string>);
  const companyName            = useFormControl(form.companyName            as FieldNode<string | null>);
  const companyInn             = useFormControl(form.companyInn             as FieldNode<string | null>);
  const companyPhone           = useFormControl(form.companyPhone           as FieldNode<string | null>);
  const companyAddress         = useFormControl(form.companyAddress         as FieldNode<string | null>);
  const position               = useFormControl(form.position               as FieldNode<string | null>);
  const workExperienceTotal    = useFormControl(form.workExperienceTotal    as FieldNode<number | null>);
  const workExperienceCurrent  = useFormControl(form.workExperienceCurrent  as FieldNode<number | null>);
  const monthlyIncome          = useFormControl(form.monthlyIncome          as FieldNode<number | null>);
  const additionalIncome       = useFormControl(form.additionalIncome       as FieldNode<number | null>);
  const additionalIncomeSource = useFormControl(form.additionalIncomeSource as FieldNode<string | null>);
  const businessType           = useFormControl(form.businessType           as FieldNode<string | null>);
  const businessInn            = useFormControl(form.businessInn            as FieldNode<string | null>);
  const businessActivity       = useFormControl(form.businessActivity       as FieldNode<string | null>);

  return (
    <section>
      <h2>Шаг 4: Информация о занятости</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>
          Статус занятости
          <select value={employmentStatus.value ?? 'employed'} onChange={(e) => form.employmentStatus.setValue(e.target.value)} disabled={employmentStatus.disabled}>
            <option value="employed">Работаю по найму</option>
            <option value="selfEmployed">Самозанятый / ИП</option>
            <option value="unemployed">Не работаю</option>
            <option value="retired">Пенсионер</option>
            <option value="student">Студент</option>
          </select>
        </label>
        <label>Название компании <input value={companyName.value ?? ''} onChange={(e) => form.companyName.setValue(e.target.value || null)} disabled={companyName.disabled} /></label>
        <label>ИНН компании <input value={companyInn.value ?? ''} onChange={(e) => form.companyInn.setValue(e.target.value || null)} disabled={companyInn.disabled} /></label>
        <label>Телефон компании <input value={companyPhone.value ?? ''} onChange={(e) => form.companyPhone.setValue(e.target.value || null)} disabled={companyPhone.disabled} /></label>
        <label>Адрес компании <input value={companyAddress.value ?? ''} onChange={(e) => form.companyAddress.setValue(e.target.value || null)} disabled={companyAddress.disabled} /></label>
        <label>Должность <input value={position.value ?? ''} onChange={(e) => form.position.setValue(e.target.value || null)} disabled={position.disabled} /></label>
        <label>Общий стаж (мес.) <input type="number" value={workExperienceTotal.value ?? ''} onChange={(e) => form.workExperienceTotal.setValue(e.target.value === '' ? null : Number(e.target.value))} disabled={workExperienceTotal.disabled} /></label>
        <label>Стаж на текущем месте (мес.) <input type="number" value={workExperienceCurrent.value ?? ''} onChange={(e) => form.workExperienceCurrent.setValue(e.target.value === '' ? null : Number(e.target.value))} disabled={workExperienceCurrent.disabled} /></label>
        <label>Ежемесячный доход (₽) <input type="number" value={monthlyIncome.value ?? ''} onChange={(e) => form.monthlyIncome.setValue(e.target.value === '' ? null : Number(e.target.value))} disabled={monthlyIncome.disabled} /></label>
        <label>Дополнительный доход (₽) <input type="number" value={additionalIncome.value ?? ''} onChange={(e) => form.additionalIncome.setValue(e.target.value === '' ? null : Number(e.target.value))} disabled={additionalIncome.disabled} /></label>
        <label>Источник доп. дохода <input value={additionalIncomeSource.value ?? ''} onChange={(e) => form.additionalIncomeSource.setValue(e.target.value || null)} disabled={additionalIncomeSource.disabled} /></label>
        <label>Тип бизнеса <input value={businessType.value ?? ''} onChange={(e) => form.businessType.setValue(e.target.value || null)} disabled={businessType.disabled} /></label>
        <label>ИНН ИП <input value={businessInn.value ?? ''} onChange={(e) => form.businessInn.setValue(e.target.value || null)} disabled={businessInn.disabled} /></label>
        <label>Вид деятельности <textarea value={businessActivity.value ?? ''} onChange={(e) => form.businessActivity.setValue(e.target.value || null)} disabled={businessActivity.disabled} /></label>
      </div>
    </section>
  );
}

// ─── FormArray item row components ──────────────────────────────────────────

function PropertyRow({ form, index, onRemove }: { form: FormProxy<PropertyItem>; index: number; onRemove: () => void }) {
  const type           = useFormControl(form.type           as FieldNode<string>);
  const description    = useFormControl(form.description    as FieldNode<string>);
  const estimatedValue = useFormControl(form.estimatedValue as FieldNode<number>);
  const hasEncumbrance = useFormControl(form.hasEncumbrance as FieldNode<boolean>);

  return (
    <div style={{ border: '1px solid #ccc', padding: 8, marginBottom: 8 }}>
      <strong>Имущество #{index + 1}</strong>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>
          Тип
          <select value={type.value ?? 'apartment'} onChange={(e) => form.type.setValue(e.target.value)} disabled={type.disabled}>
            <option value="apartment">Квартира</option>
            <option value="house">Дом</option>
            <option value="land">Земельный участок</option>
            <option value="car">Автомобиль</option>
            <option value="other">Другое</option>
          </select>
        </label>
        <label>Описание <textarea value={description.value ?? ''} onChange={(e) => form.description.setValue(e.target.value)} disabled={description.disabled} /></label>
        <label>Оценочная стоимость <input type="number" value={estimatedValue.value ?? 0} onChange={(e) => form.estimatedValue.setValue(Number(e.target.value))} disabled={estimatedValue.disabled} /></label>
        <label>
          <input type="checkbox" checked={hasEncumbrance.value ?? false} onChange={(e) => form.hasEncumbrance.setValue(e.target.checked)} disabled={hasEncumbrance.disabled} />
          Имеется обременение
        </label>
      </div>
      <button type="button" onClick={onRemove}>Удалить</button>
    </div>
  );
}

function ExistingLoanRow({ form, index, onRemove }: { form: FormProxy<ExistingLoanItem>; index: number; onRemove: () => void }) {
  const bank            = useFormControl(form.bank            as FieldNode<string>);
  const type            = useFormControl(form.type            as FieldNode<string>);
  const amount          = useFormControl(form.amount          as FieldNode<number>);
  const remainingAmount = useFormControl(form.remainingAmount as FieldNode<number>);
  const monthlyPayment  = useFormControl(form.monthlyPayment  as FieldNode<number>);
  const maturityDate    = useFormControl(form.maturityDate    as FieldNode<string>);

  return (
    <div style={{ border: '1px solid #ccc', padding: 8, marginBottom: 8 }}>
      <strong>Кредит #{index + 1}</strong>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>Банк <input value={bank.value ?? ''} onChange={(e) => form.bank.setValue(e.target.value)} disabled={bank.disabled} /></label>
        <label>Тип кредита <input value={type.value ?? ''} onChange={(e) => form.type.setValue(e.target.value)} disabled={type.disabled} /></label>
        <label>Сумма кредита <input type="number" value={amount.value ?? 0} onChange={(e) => form.amount.setValue(Number(e.target.value))} disabled={amount.disabled} /></label>
        <label>Остаток задолженности <input type="number" value={remainingAmount.value ?? 0} onChange={(e) => form.remainingAmount.setValue(Number(e.target.value))} disabled={remainingAmount.disabled} /></label>
        <label>Ежемесячный платеж <input type="number" value={monthlyPayment.value ?? 0} onChange={(e) => form.monthlyPayment.setValue(Number(e.target.value))} disabled={monthlyPayment.disabled} /></label>
        <label>Дата погашения <input type="date" value={maturityDate.value ?? ''} onChange={(e) => form.maturityDate.setValue(e.target.value)} disabled={maturityDate.disabled} /></label>
      </div>
      <button type="button" onClick={onRemove}>Удалить</button>
    </div>
  );
}

function CoBorrowerRow({ form, index, onRemove }: { form: FormProxy<CoBorrowerItem>; index: number; onRemove: () => void }) {
  const phone         = useFormControl(form.phone         as FieldNode<string>);
  const emailCtrl     = useFormControl(form.email         as FieldNode<string>);
  const relationship  = useFormControl(form.relationship  as FieldNode<string>);
  const monthlyIncome = useFormControl(form.monthlyIncome as FieldNode<number>);

  return (
    <div style={{ border: '1px solid #ccc', padding: 8, marginBottom: 8 }}>
      <strong>Созаёмщик #{index + 1}</strong>
      <fieldset>
        <legend>Личные данные</legend>
        <PersonalDataFields form={form.personalData} />
      </fieldset>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>Телефон <input value={phone.value ?? ''} onChange={(e) => form.phone.setValue(e.target.value)} disabled={phone.disabled} /></label>
        <label>Email <input type="email" value={emailCtrl.value ?? ''} onChange={(e) => form.email.setValue(e.target.value)} disabled={emailCtrl.disabled} /></label>
        <label>Родство <input value={relationship.value ?? ''} onChange={(e) => form.relationship.setValue(e.target.value)} disabled={relationship.disabled} /></label>
        <label>Ежемесячный доход <input type="number" value={monthlyIncome.value ?? 0} onChange={(e) => form.monthlyIncome.setValue(Number(e.target.value))} disabled={monthlyIncome.disabled} /></label>
      </div>
      <button type="button" onClick={onRemove}>Удалить</button>
    </div>
  );
}

function Step5Section({ form }: { form: FormProxy<Step5Additional> }) {
  const maritalStatus    = useFormControl(form.maritalStatus    as FieldNode<string>);
  const dependents       = useFormControl(form.dependents       as FieldNode<number>);
  const education        = useFormControl(form.education        as FieldNode<string>);
  const hasProperty      = useFormControl(form.hasProperty      as FieldNode<boolean>);
  const hasExistingLoans = useFormControl(form.hasExistingLoans as FieldNode<boolean>);
  const hasCoBorrower    = useFormControl(form.hasCoBorrower    as FieldNode<boolean>);

  const propertiesLen    = useArrayLength(form.properties);
  const existingLoansLen = useArrayLength(form.existingLoans);
  const coBorrowersLen   = useArrayLength(form.coBorrowers);

  return (
    <section>
      <h2>Шаг 5: Дополнительная информация</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>
          Семейное положение
          <select value={maritalStatus.value ?? 'single'} onChange={(e) => form.maritalStatus.setValue(e.target.value)} disabled={maritalStatus.disabled}>
            <option value="single">Холост/Не замужем</option>
            <option value="married">Женат/Замужем</option>
            <option value="divorced">Разведён/Разведена</option>
            <option value="widowed">Вдовец/Вдова</option>
          </select>
        </label>
        <label>Количество иждивенцев <input type="number" value={dependents.value ?? 0} onChange={(e) => form.dependents.setValue(Number(e.target.value))} disabled={dependents.disabled} /></label>
        <label>
          Образование
          <select value={education.value ?? 'higher'} onChange={(e) => form.education.setValue(e.target.value)} disabled={education.disabled}>
            <option value="secondary">Среднее</option>
            <option value="specialized">Среднее специальное</option>
            <option value="higher">Высшее</option>
            <option value="postgraduate">Послевузовское</option>
          </select>
        </label>
      </div>

      {/* Properties array */}
      <fieldset>
        <legend>
          <label>
            <input type="checkbox" checked={hasProperty.value ?? false} onChange={(e) => form.hasProperty.setValue(e.target.checked)} disabled={hasProperty.disabled} />
            У меня есть имущество
          </label>
        </legend>
        {Array.from({ length: propertiesLen }, (_, index) => (
          <PropertyRow
            key={index}
            form={form.properties.at(index)}
            index={index}
            onRemove={() => { form.properties.removeAt(index); }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            form.properties.push({
              type: 'apartment',
              description: '',
              estimatedValue: 0,
              hasEncumbrance: false,
            });
          }}
        >
          + Добавить имущество ({propertiesLen})
        </button>
      </fieldset>

      {/* Existing loans array */}
      <fieldset>
        <legend>
          <label>
            <input type="checkbox" checked={hasExistingLoans.value ?? false} onChange={(e) => form.hasExistingLoans.setValue(e.target.checked)} disabled={hasExistingLoans.disabled} />
            У меня есть другие кредиты
          </label>
        </legend>
        {Array.from({ length: existingLoansLen }, (_, index) => (
          <ExistingLoanRow
            key={index}
            form={form.existingLoans.at(index)}
            index={index}
            onRemove={() => { form.existingLoans.removeAt(index); }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            form.existingLoans.push({
              bank: '',
              type: '',
              amount: 0,
              remainingAmount: 0,
              monthlyPayment: 0,
              maturityDate: '',
            });
          }}
        >
          + Добавить кредит ({existingLoansLen})
        </button>
      </fieldset>

      {/* Co-borrowers array */}
      <fieldset>
        <legend>
          <label>
            <input type="checkbox" checked={hasCoBorrower.value ?? false} onChange={(e) => form.hasCoBorrower.setValue(e.target.checked)} disabled={hasCoBorrower.disabled} />
            Добавить созаёмщика
          </label>
        </legend>
        {Array.from({ length: coBorrowersLen }, (_, index) => (
          <CoBorrowerRow
            key={index}
            form={form.coBorrowers.at(index)}
            index={index}
            onRemove={() => { form.coBorrowers.removeAt(index); }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            form.coBorrowers.push({
              personalData: { lastName: '', firstName: '', middleName: '', birthDate: '', gender: 'male', birthPlace: '' },
              phone: '',
              email: '',
              relationship: '',
              monthlyIncome: 0,
            });
          }}
        >
          + Добавить созаёмщика ({coBorrowersLen})
        </button>
      </fieldset>
    </section>
  );
}

function Step6Section({ form }: { form: FormProxy<Step6Confirmation> }) {
  const agreePersonalData  = useFormControl(form.agreePersonalData  as FieldNode<boolean>);
  const agreeCreditHistory = useFormControl(form.agreeCreditHistory as FieldNode<boolean>);
  const agreeMarketing     = useFormControl(form.agreeMarketing     as FieldNode<boolean>);
  const agreeTerms         = useFormControl(form.agreeTerms         as FieldNode<boolean>);
  const confirmAccuracy    = useFormControl(form.confirmAccuracy    as FieldNode<boolean>);
  const electronicSig      = useFormControl(form.electronicSignature as FieldNode<string>);

  return (
    <section>
      <h2>Шаг 6: Подтверждение и согласия</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>
          <input type="checkbox" checked={agreePersonalData.value ?? false} onChange={(e) => form.agreePersonalData.setValue(e.target.checked)} disabled={agreePersonalData.disabled} />
          Согласие на обработку персональных данных
        </label>
        <label>
          <input type="checkbox" checked={agreeCreditHistory.value ?? false} onChange={(e) => form.agreeCreditHistory.setValue(e.target.checked)} disabled={agreeCreditHistory.disabled} />
          Согласие на проверку кредитной истории
        </label>
        <label>
          <input type="checkbox" checked={agreeMarketing.value ?? false} onChange={(e) => form.agreeMarketing.setValue(e.target.checked)} disabled={agreeMarketing.disabled} />
          Согласие на получение маркетинговых материалов
        </label>
        <label>
          <input type="checkbox" checked={agreeTerms.value ?? false} onChange={(e) => form.agreeTerms.setValue(e.target.checked)} disabled={agreeTerms.disabled} />
          Согласие с условиями кредитования
        </label>
        <label>
          <input type="checkbox" checked={confirmAccuracy.value ?? false} onChange={(e) => form.confirmAccuracy.setValue(e.target.checked)} disabled={confirmAccuracy.disabled} />
          Подтверждаю точность введённых данных
        </label>
        <label>
          Код подтверждения из СМС
          <input value={electronicSig.value ?? ''} onChange={(e) => form.electronicSignature.setValue(e.target.value)} disabled={electronicSig.disabled} />
        </label>
      </div>
    </section>
  );
}

// ─── Root component ─────────────────────────────────────────────────────────

export default function McpCreditApplication() {
  const form = creditApplicationForm;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Заявка на кредит</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          console.log('Credit application submitted');
        }}
      >
        <Step1Section form={form.step1} />
        <Step2Section form={form.step2} />
        <Step3Section form={form.step3} />
        <Step4Section form={form.step4} />
        <Step5Section form={form.step5} />
        <Step6Section form={form.step6} />
        <div style={{ marginTop: 24 }}>
          <button type="submit">Отправить заявку</button>
        </div>
      </form>
    </div>
  );
}
