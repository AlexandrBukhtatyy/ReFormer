/**
 * Схема формы: одно дерево узлов, по нему строится форма и рисуется разметка.
 * Создание и редактирование — визард из шести шагов. Просмотр — те же шаги секциями подряд,
 * потому что у библиотечного визарда нет способа убрать кнопку отправки на последнем шаге.
 */
import type { ReactNode } from 'react';
import type {
  ComponentRef,
  FormArray,
  FormGroup,
  FormModel,
  FormSchemaNode,
  SchemaFieldNode,
} from '@reformer/core';
import { useFormBundleContext } from '@reformer/core/react';
import { FieldArray as ArrayState } from '@reformer/cdk/field-array';
import { Step } from '@reformer/cdk/form-wizard';
import {
  Box,
  Button,
  CheckboxWithLabel,
  FieldArray,
  FormWizard,
  Input,
  InputMask,
  InputNumber,
  RadioGroupOptions,
  Section,
  SelectAsync,
  Textarea,
  type ArrayComponentProps,
  type SelectAsyncProps,
} from '@reformer/ui-kit';
import {
  BODY_TYPES,
  CLAIM_TYPES,
  GENDERS,
  INSTALLMENT_COUNTS,
  INSURANCE_PERIODS,
  INSURANCE_TYPES,
  INSURED_TYPES,
  MASKS,
  PAYMENT_TYPES,
  PROPERTY_TYPES,
  REFERRAL_SOURCES,
  RELATIONSHIPS,
  TRANSMISSIONS,
  TRAVEL_DESTINATIONS,
  TRIP_PURPOSES,
  USAGE_PURPOSES,
  WALL_MATERIALS,
  type Beneficiary,
  type Claim,
  type Driver,
  type FormMode,
  type InsuranceApplicationForm,
  type Option,
  type Traveler,
} from './types';

type Form = InsuranceApplicationForm;
type Handle = SchemaFieldNode['model'];

// ---------------------------------------------------------------------------
// Компоненты схемы
// ---------------------------------------------------------------------------

interface NumberSelectProps extends Omit<SelectAsyncProps, 'value' | 'onChange'> {
  value?: number | null;
  onChange?: (value: number | null) => void;
}

/**
 * SelectAsync работает со строками, а срок и число платежей в модели — числа.
 * defineFieldControl здесь не подходит: он вешает статику на сам компонент, то есть
 * поменял бы контракт всех SelectAsync формы.
 */
function NumberSelect({ value, onChange, ...props }: NumberSelectProps): ReactNode {
  return (
    <SelectAsync
      {...props}
      value={value === null || value === undefined ? null : String(value)}
      onChange={(next) => onChange?.(next === null ? null : Number(next))}
    />
  );
}

interface ReadOnlyArrayProps extends ArrayComponentProps {
  title?: string;
  itemLabel?: string;
  emptyMessage?: string;
}

/** Массив в режиме просмотра: у FieldArray нет режима без кнопок «Добавить» и «Удалить». */
function ReadOnlyArray({
  items = [],
  title,
  itemLabel,
  emptyMessage,
}: ReadOnlyArrayProps): ReactNode {
  return (
    <Section title={title} className="space-y-3">
      {items.length === 0 && emptyMessage && (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      )}
      {items.map((item) => (
        <div key={item.key} className="rounded border p-4">
          {itemLabel && (
            <p className="mb-2 text-sm font-medium">
              {itemLabel} {item.index + 1}
            </p>
          )}
          {item.children}
        </div>
      ))}
    </Section>
  );
}

/** Замечание уровня массива («добавьте хотя бы одну строку»): строки его не показывают. */
function createArrayIssues<T extends object>(
  select: (form: FormGroup<Form>) => FormArray<T>
): () => ReactNode {
  return function ArrayIssues() {
    const bundle = useFormBundleContext<Form>();
    if (!bundle) return null;
    return (
      <ArrayState.Root control={select(bundle.form)}>
        <div className="text-sm text-destructive">
          <ArrayState.Error />
        </div>
      </ArrayState.Root>
    );
  };
}

const TravelersIssues = createArrayIssues<Traveler>((form) => form.travelers);
const DriversIssues = createArrayIssues<Driver>((form) => form.drivers);
const ClaimsIssues = createArrayIssues<Claim>((form) => form.claims);

interface SmsActionsProps {
  hint?: string;
  onResend?: () => void;
}

function SmsActions({ hint, onResend }: SmsActionsProps): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" size="sm" onClick={() => onResend?.()}>
        Запросить новый код
      </Button>
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Построители узлов
// ---------------------------------------------------------------------------

const field = (
  model: Handle,
  component: ComponentRef,
  componentProps: Record<string, unknown>,
  selector?: string
): SchemaFieldNode => ({
  ...(selector ? { selector } : {}),
  model,
  component,
  componentProps,
});

const text = (model: Handle, label: string, placeholder?: string, selector?: string) =>
  field(model, Input, { label, placeholder }, selector);

const date = (model: Handle, label: string, selector?: string) =>
  field(model, Input, { label, type: 'date' }, selector);

const num = (model: Handle, label: string, placeholder?: string, selector?: string) =>
  field(model, InputNumber, { label, placeholder }, selector);

const select = <V extends string>(
  model: Handle,
  label: string,
  options: Option<V>[],
  placeholder: string,
  selector?: string
) => field(model, SelectAsync, { label, options, placeholder }, selector);

const numberSelect = (
  model: Handle,
  label: string,
  options: Option<number>[],
  placeholder: string,
  selector?: string
) => field(model, NumberSelect, { label, options, placeholder }, selector);

const radio = <V extends string>(model: Handle, label: string, options: Option<V>[]) =>
  field(model, RadioGroupOptions, { label, options });

const checkbox = (model: Handle, label: string, selector?: string) =>
  field(model, CheckboxWithLabel, { label }, selector);

const mask = (model: Handle, label: string, maskValue: string, placeholder: string) =>
  field(model, InputMask, { label, mask: maskValue, placeholder });

const textarea = (model: Handle, label: string, placeholder?: string, selector?: string) =>
  field(model, Textarea, { label, placeholder }, selector);

/** Вычисляемое поле: readOnly, а не disabled — правила по выключенным полям не считаются. */
const computedNumber = (model: Handle, label: string) =>
  field(model, InputNumber, { label, readOnly: true });

const grid = (...children: FormSchemaNode[]): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'grid grid-cols-1 gap-4 md:grid-cols-2' },
  children,
});

const section = (title: string, children: FormSchemaNode[], selector?: string): FormSchemaNode => ({
  ...(selector ? { selector } : {}),
  component: Section,
  componentProps: { title, className: 'space-y-4' },
  children,
});

// ---------------------------------------------------------------------------
// Схема
// ---------------------------------------------------------------------------

export const createApplicationSchema = (mode: FormMode) => {
  const isView = mode === 'view';
  const arrayComponent: ComponentRef = isView ? ReadOnlyArray : FieldArray;

  const step = (
    selector: string,
    title: string,
    icon: string,
    children: FormSchemaNode[]
  ): FormSchemaNode =>
    isView
      ? {
          selector,
          component: Section,
          componentProps: { title, titleAs: 'h2', className: 'space-y-6' },
          children,
        }
      : { selector, component: Step, componentProps: { title, icon }, children };

  const travelerRow = (row: FormModel<Traveler>): FormSchemaNode =>
    grid(
      text(row.$.fullName, 'ФИО', 'Ivanov Ivan'),
      date(row.$.birthDate, 'Дата рождения'),
      text(row.$.passportNumber, 'Номер загранпаспорта', '00 0000000')
    );

  const driverRow = (row: FormModel<Driver>): FormSchemaNode =>
    grid(
      text(row.$.fullName, 'ФИО водителя', 'Иванов Иван Иванович'),
      date(row.$.birthDate, 'Дата рождения'),
      text(row.$.licenseNumber, 'Номер ВУ', '00 00 000000'),
      date(row.$.licenseIssueDate, 'Дата выдачи ВУ'),
      computedNumber(row.$.drivingExperience, 'Стаж вождения (лет)'),
      num(row.$.accidentsCount, 'Кол-во ДТП за 3 года', '0'),
      checkbox(row.$.isMainDriver, 'Основной водитель')
    );

  const beneficiaryRow = (row: FormModel<Beneficiary>): FormSchemaNode =>
    grid(
      text(row.$.fullName, 'ФИО', 'Иванов Иван Иванович'),
      date(row.$.birthDate, 'Дата рождения'),
      select(row.$.relationship, 'Степень родства', RELATIONSHIPS, 'Выберите'),
      num(row.$.share, 'Доля (%)', '50'),
      mask(row.$.phone, 'Телефон', MASKS.phone, '+7 (___) ___-__-__')
    );

  const claimRow = (row: FormModel<Claim>): FormSchemaNode =>
    grid(
      date(row.$.date, 'Дата события'),
      select(row.$.type, 'Тип события', CLAIM_TYPES, 'Выберите тип'),
      textarea(row.$.description, 'Описание', 'Опишите событие'),
      num(row.$.amount, 'Сумма выплаты (₽)', '100000'),
      checkbox(row.$.atFault, 'По вине страхователя')
    );

  return (model: FormModel<Form>): FormSchemaNode => {
    const steps: FormSchemaNode[] = [
      step('insurance', 'Тип страхования', '📋', [
        section('Основное', [
          grid(
            select(
              model.$.insuranceType,
              'Тип страхования',
              INSURANCE_TYPES,
              'Выберите тип страхования'
            ),
            numberSelect(
              model.$.insurancePeriod,
              'Срок страхования',
              INSURANCE_PERIODS,
              'Выберите срок'
            ),
            date(model.$.startDate, 'Дата начала действия полиса'),
            field(model.$.endDate, Input, {
              label: 'Дата окончания',
              type: 'date',
              readOnly: true,
            }),
            num(model.$.coverageAmount, 'Страховая сумма (₽)', 'от 100 000 до 50 000 000'),
            num(model.$.deductible, 'Франшиза (₽)', '0')
          ),
        ]),
        section('Оплата', [
          radio(model.$.paymentType, 'Способ оплаты', PAYMENT_TYPES),
          numberSelect(
            model.$.installments,
            'Количество платежей',
            INSTALLMENT_COUNTS,
            'Выберите количество',
            'installments'
          ),
        ]),
      ]),

      step('insured', 'Страхователь', '👤', [
        radio(model.$.insuredType, 'Тип страхователя', INSURED_TYPES),
        section(
          'Личные данные',
          [
            grid(
              text(model.$.personalData.lastName, 'Фамилия', 'Введите фамилию'),
              text(model.$.personalData.firstName, 'Имя', 'Введите имя'),
              text(model.$.personalData.middleName, 'Отчество', 'Введите отчество'),
              date(model.$.personalData.birthDate, 'Дата рождения'),
              radio(model.$.personalData.gender, 'Пол', GENDERS),
              field(model.$.fullName, Input, { label: 'Полное имя (ФИО)', readOnly: true }),
              computedNumber(model.$.age, 'Возраст')
            ),
          ],
          'personal-section'
        ),
        section(
          'Паспортные данные',
          [
            grid(
              mask(model.$.passportData.series, 'Серия паспорта', MASKS.passportSeries, '12 34'),
              mask(model.$.passportData.number, 'Номер паспорта', MASKS.passportNumber, '123456'),
              date(model.$.passportData.issueDate, 'Дата выдачи'),
              text(model.$.passportData.issuedBy, 'Кем выдан', 'Отделением УФМС...')
            ),
          ],
          'passport-section'
        ),
        section(
          'Компания',
          [
            grid(
              text(model.$.companyData.name, 'Название организации', 'ООО "Компания"'),
              mask(model.$.companyData.inn, 'ИНН организации', MASKS.inn, '1234567890'),
              mask(model.$.companyData.ogrn, 'ОГРН', MASKS.ogrn, '1234567890123'),
              mask(model.$.companyData.kpp, 'КПП', MASKS.kpp, '123456789'),
              text(model.$.companyData.ceoName, 'ФИО руководителя', 'Иванов Иван Иванович')
            ),
          ],
          'company-section'
        ),
        section('Контакты', [
          grid(
            mask(model.$.phone, 'Телефон', MASKS.phone, '+7 (___) ___-__-__'),
            field(model.$.email, Input, {
              label: 'Email',
              type: 'email',
              placeholder: 'example@mail.com',
            })
          ),
        ]),
      ]),

      step('object', 'Объект страхования', '🛡️', [
        section(
          'Транспорт',
          [
            grid(
              text(model.$.vehicle.vin, 'VIN-номер', 'XXXXXXXXXXXXXXXXX'),
              field(model.$.vehicle.brand, SelectAsync, {
                label: 'Марка автомобиля',
                options: [],
                placeholder: 'Выберите марку',
              }),
              field(model.$.vehicle.model, SelectAsync, {
                label: 'Модель автомобиля',
                options: [],
                placeholder: 'Сначала выберите марку',
              }),
              num(model.$.vehicle.year, 'Год выпуска', '2020'),
              num(model.$.vehicle.mileage, 'Пробег (км)', '50000'),
              num(model.$.vehicle.enginePower, 'Мощность двигателя (л.с.)', '150'),
              select(model.$.vehicle.bodyType, 'Тип кузова', BODY_TYPES, 'Выберите тип'),
              radio(model.$.vehicle.transmission, 'Коробка передач', TRANSMISSIONS),
              num(
                model.$.vehicle.marketValue,
                'Рыночная стоимость (₽)',
                '1500000',
                'vehicle.marketValue'
              ),
              text(model.$.vehicle.licensePlate, 'Госномер', 'А000АА000'),
              text(model.$.vehicle.registrationCert, 'Номер СТС', '00 00 000000'),
              select(
                model.$.vehicle.usagePurpose,
                'Цель использования',
                USAGE_PURPOSES,
                'Выберите цель'
              )
            ),
            checkbox(model.$.vehicle.hasAntiTheft, 'Наличие противоугонной системы'),
            text(
              model.$.vehicle.antiTheftBrand,
              'Марка противоугонной системы',
              'StarLine',
              'vehicle.antiTheftBrand'
            ),
            checkbox(model.$.vehicle.garageParking, 'Гаражное хранение'),
          ],
          'vehicle-section'
        ),

        section(
          'Недвижимость',
          [
            select(model.$.property.type, 'Тип недвижимости', PROPERTY_TYPES, 'Выберите тип'),
            section('Адрес', [
              grid(
                text(model.$.property.address.region, 'Регион', 'Московская область'),
                text(model.$.property.address.city, 'Город', 'Москва'),
                text(model.$.property.address.street, 'Улица', 'ул. Ленина'),
                text(model.$.property.address.house, 'Дом', '1'),
                text(model.$.property.address.apartment, 'Квартира', '1')
              ),
            ]),
            section('Характеристики', [
              grid(
                num(model.$.property.area, 'Площадь (м²)', '50'),
                num(model.$.property.floors, 'Этажность здания', '9'),
                num(model.$.property.floor, 'Этаж квартиры', '5', 'property.floor'),
                num(model.$.property.yearBuilt, 'Год постройки', '2010'),
                select(
                  model.$.property.wallMaterial,
                  'Материал стен',
                  WALL_MATERIALS,
                  'Выберите материал'
                ),
                num(model.$.property.marketValue, 'Рыночная стоимость (₽)', '5000000')
              ),
            ]),
            section('Безопасность', [
              checkbox(model.$.property.hasAlarm, 'Охранная сигнализация'),
              checkbox(model.$.property.hasFireAlarm, 'Пожарная сигнализация'),
            ]),
            text(
              model.$.property.ownershipDoc,
              'Номер документа о собственности',
              '00-00/000-00/000/000/0000-0000'
            ),
            section('Покрытие', [
              checkbox(model.$.propertyCoverageOptions.structure, 'Страхование конструктива'),
              checkbox(model.$.propertyCoverageOptions.interior, 'Страхование отделки'),
              checkbox(model.$.propertyCoverageOptions.movables, 'Страхование движимого имущества'),
              checkbox(model.$.propertyCoverageOptions.liability, 'Гражданская ответственность'),
            ]),
          ],
          'property-section'
        ),

        section(
          'Жизнь и здоровье',
          [
            grid(
              num(model.$.health.height, 'Рост (см)', '175'),
              num(model.$.health.weight, 'Вес (кг)', '70'),
              computedNumber(model.$.health.bmi, 'Индекс массы тела'),
              text(model.$.health.bloodPressure, 'Артериальное давление', '120/80')
            ),
            checkbox(model.$.health.isSmoker, 'Курящий'),
            num(model.$.health.smokingYears, 'Стаж курения (лет)', '5', 'health.smokingYears'),
            checkbox(model.$.health.hasChronicDiseases, 'Хронические заболевания'),
            textarea(
              model.$.health.chronicDiseases,
              'Описание заболеваний',
              'Перечислите заболевания',
              'health.chronicDiseases'
            ),
            checkbox(model.$.health.hadSurgeries, 'Перенесенные операции'),
            textarea(
              model.$.health.surgeries,
              'Описание операций',
              'Перечислите операции',
              'health.surgeries'
            ),
            text(model.$.health.occupation, 'Род занятий', 'Менеджер'),
            checkbox(model.$.health.isHighRiskJob, 'Опасная профессия'),
            checkbox(model.$.health.practicesSports, 'Занятия спортом'),
            checkbox(
              model.$.health.extremeSports,
              'Экстремальные виды спорта',
              'health.extremeSports'
            ),
            section('Покрытие', [
              checkbox(model.$.lifeCoverageOptions.death, 'Страхование на случай смерти'),
              checkbox(model.$.lifeCoverageOptions.disability, 'Страхование инвалидности'),
              checkbox(model.$.lifeCoverageOptions.criticalIllness, 'Критические заболевания'),
              checkbox(model.$.lifeCoverageOptions.accident, 'Несчастные случаи'),
            ]),
          ],
          'health-section'
        ),

        section(
          'Путешествие',
          [
            grid(
              field(model.$.travel.destination, SelectAsync, {
                label: 'Страна/регион назначения',
                options: TRAVEL_DESTINATIONS,
                placeholder: 'Выберите регион',
              }),
              select(model.$.travel.tripPurpose, 'Цель поездки', TRIP_PURPOSES, 'Выберите цель'),
              date(model.$.travel.departureDate, 'Дата отъезда'),
              date(model.$.travel.returnDate, 'Дата возвращения'),
              computedNumber(model.$.travel.tripDuration, 'Длительность поездки (дни)')
            ),
            checkbox(model.$.travel.isMultipleTrips, 'Мультипоездка (годовой полис)'),
            {
              model: model.$.travelers,
              component: arrayComponent,
              componentProps: {
                title: 'Путешественники',
                itemLabel: 'Путешественник',
                addButtonLabel: '+ Добавить путешественника',
                emptyMessage: 'Путешественники не добавлены',
                showRemoveOnSingle: true,
              },
              item: travelerRow,
            },
            { component: TravelersIssues },
            section('Покрытие', [
              checkbox(model.$.travelCoverageOptions.medical, 'Медицинские расходы'),
              checkbox(model.$.travelCoverageOptions.baggage, 'Багаж'),
              checkbox(model.$.travelCoverageOptions.tripCancellation, 'Отмена поездки'),
              checkbox(model.$.travelCoverageOptions.flightDelay, 'Задержка рейса'),
              checkbox(model.$.travelCoverageOptions.carRental, 'Аренда авто'),
            ]),
          ],
          'travel-section'
        ),
      ]),

      step('people', 'Водители и получатели', '👥', [
        section(
          'Водители',
          [
            checkbox(model.$.unlimitedDrivers, 'Неограниченное количество водителей'),
            {
              selector: 'drivers-list',
              component: Box,
              componentProps: { className: 'space-y-4' },
              children: [
                {
                  model: model.$.drivers,
                  component: arrayComponent,
                  componentProps: {
                    itemLabel: 'Водитель',
                    addButtonLabel: '+ Добавить водителя',
                    emptyMessage: 'Водители не добавлены',
                    showRemoveOnSingle: true,
                  },
                  item: driverRow,
                },
                { component: DriversIssues },
                grid(
                  computedNumber(model.$.minDriverAge, 'Мин. возраст водителя'),
                  computedNumber(model.$.minDriverExperience, 'Мин. стаж водителя')
                ),
              ],
            },
          ],
          'drivers-section'
        ),
        section(
          'Выгодоприобретатели',
          [
            {
              model: model.$.beneficiaries,
              component: arrayComponent,
              componentProps: {
                itemLabel: 'Выгодоприобретатель',
                addButtonLabel: '+ Добавить выгодоприобретателя',
                emptyMessage: 'Выгодоприобретатели не добавлены',
                showRemoveOnSingle: true,
              },
              item: beneficiaryRow,
            },
            computedNumber(model.$.totalBeneficiaryShare, 'Сумма долей (%)'),
          ],
          'beneficiaries-section'
        ),
        {
          selector: 'people-empty-note',
          component: 'p',
          componentProps: { className: 'text-sm text-muted-foreground' },
          children: ['Для выбранного типа страхования этот шаг заполнять не нужно.'],
        },
      ]),

      step('history', 'История', '📜', [
        section('Предыдущий полис', [
          checkbox(model.$.hasPreviousInsurance, 'Был ли полис ранее'),
          {
            selector: 'previous-insurance',
            component: Box,
            componentProps: { className: 'grid grid-cols-1 gap-4 md:grid-cols-2' },
            children: [
              text(model.$.previousInsurer, 'Предыдущий страховщик', 'Название компании'),
              text(model.$.previousPolicyNumber, 'Номер предыдущего полиса', 'XXX-000000'),
              date(model.$.previousPolicyEndDate, 'Дата окончания предыдущего полиса'),
            ],
          },
        ]),
        section('Страховые случаи', [
          checkbox(model.$.hadClaims, 'Были ли страховые случаи'),
          {
            selector: 'claims-list',
            component: Box,
            componentProps: { className: 'space-y-4' },
            children: [
              {
                model: model.$.claims,
                component: arrayComponent,
                componentProps: {
                  itemLabel: 'Страховой случай',
                  addButtonLabel: '+ Добавить случай',
                  emptyMessage: 'Страховые случаи не добавлены',
                  showRemoveOnSingle: true,
                },
                item: claimRow,
              },
              { component: ClaimsIssues },
            ],
          },
        ]),
        section('Дополнительно', [
          grid(
            text(model.$.promoCode, 'Промокод', 'PROMO2024'),
            select(
              model.$.referralSource,
              'Откуда узнали о нас',
              REFERRAL_SOURCES,
              'Выберите источник'
            ),
            text(model.$.agentCode, 'Код агента', 'AGT-000')
          ),
          textarea(model.$.additionalNotes, 'Дополнительные комментарии', 'Ваши пожелания...'),
        ]),
      ]),

      step('confirmation', 'Подтверждение', '✅', [
        section('Расчёт', [
          grid(
            computedNumber(model.$.basePremium, 'Базовая премия (₽)'),
            computedNumber(model.$.ageCoefficient, 'Коэффициент возраста'),
            computedNumber(model.$.experienceCoefficient, 'Коэффициент стажа'),
            computedNumber(model.$.regionCoefficient, 'Региональный коэффициент'),
            computedNumber(model.$.claimsCoefficient, 'Коэффициент аварийности (КБМ)'),
            computedNumber(model.$.deductibleDiscount, 'Скидка за франшизу (%)'),
            computedNumber(model.$.promoDiscount, 'Скидка по промокоду (%)'),
            computedNumber(model.$.multiPolicyDiscount, 'Скидка за комплексное страхование (%)'),
            computedNumber(model.$.totalPremium, 'Итоговая премия (₽)'),
            computedNumber(model.$.installmentAmount, 'Сумма платежа (₽)')
          ),
        ]),
        section('Согласия', [
          checkbox(model.$.agreePersonalData, 'Согласие на обработку персональных данных'),
          checkbox(model.$.agreeTerms, 'Согласие с правилами страхования'),
          checkbox(model.$.agreeElectronicPolicy, 'Согласие на электронный полис'),
          checkbox(model.$.agreeMarketing, 'Согласие на рекламу'),
        ]),
        section('Подтверждение', [
          checkbox(model.$.confirmAccuracy, 'Подтверждение достоверности данных'),
          mask(model.$.electronicSignature, 'SMS-код подтверждения', MASKS.smsCode, '000000'),
          ...(isView ? [] : [{ selector: 'sms-actions', component: SmsActions }]),
        ]),
      ]),
    ];

    return isView
      ? {
          selector: 'wizard',
          component: Box,
          componentProps: { className: 'space-y-8' },
          children: steps,
        }
      : {
          selector: 'wizard',
          component: FormWizard,
          componentProps: { submitLabel: 'Отправить заявку' },
          children: steps,
        };
  };
};
