/**
 * Поведение формы: вычисления, условные поля, сбросы, загрузка опций, отправка.
 *
 * Поведение — фабрика, потому что зависит от режима и колбэков страницы.
 * В режиме просмотра условия enableWhen всегда ложны и сброс при выключении отключён:
 * иначе enableWhen снова включал бы поля после form.disable(), а resetOnDisable стирал
 * загруженные данные. Видимость (hideWhen) от режима не зависит.
 */
import {
  applyEach,
  compute,
  defineFormBehavior,
  enableWhen,
  exclusiveFlag,
  hideWhen,
  onChange,
  onComponentEvent,
  revalidateWhen,
  transformValue,
} from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';
import {
  calculatePremium,
  createApplication,
  DEMO_SMS_CODE,
  InvalidSmsCodeError,
  sendVerification,
  validatePromo,
  type CreatedApplication,
} from './api';
import { loadCarModels } from './data-sources';
import { CONFIRMATION_STEP } from './form.flow';
import { warningRules } from './form.validation';
import {
  addMonths,
  calculateAgeCoefficient,
  calculateBasePremium,
  calculateClaimsCoefficient,
  calculateDeductibleDiscount,
  calculateExperienceCoefficient,
  calculateInstallmentAmount,
  calculateMultiPolicyDiscount,
  calculateRegionCoefficient,
  calculateRiskFactor,
  calculateTotalPremium,
  daysBetween,
  formatByMask,
  fullYearsSince,
  isVehicleInsurance,
  MASKS,
  round2,
  type Beneficiary,
  type Driver,
  type FormMode,
  type InsuranceApplicationForm,
} from './types';

type Form = InsuranceApplicationForm;

const MAX_SMS_ATTEMPTS = 3;
const toPercent = (fraction: number): number => round2(fraction * 100);

const driverRowBehavior = defineFormBehavior<Driver>(({ model: row }) => {
  compute(row.$.drivingExperience, () => fullYearsSince(row.licenseIssueDate));
});

const beneficiaryRowBehavior = defineFormBehavior<Beneficiary>(({ model: row }) => {
  transformValue(row.$.phone, (value) => formatByMask(value ?? '', MASKS.phone));
});

export interface ApplicationBehaviorOptions {
  mode: FormMode;
  onSubmitted: (result: CreatedApplication) => void;
  /** null — снять показанную ошибку отправки. */
  onSubmitError: (message: string | null) => void;
}

export const createApplicationBehavior = ({
  mode,
  onSubmitted,
  onSubmitError,
}: ApplicationBehaviorOptions) =>
  defineFormBehavior<Form>(({ model, form, schema, flow }) => {
    const isView = mode === 'view';

    const isVehicle = () => isVehicleInsurance(model.insuranceType);
    const isProperty = () => model.insuranceType === 'property';
    const isLife = () => model.insuranceType === 'life';
    const isTravel = () => model.insuranceType === 'travel';
    const isIndividual = () => model.insuredType === 'individual';
    const isCompany = () => model.insuredType === 'company';

    /** enableWhen: в просмотре поле не включается и не сбрасывается. */
    const enableOn = (target: Parameters<typeof enableWhen>[0], condition: () => boolean): void => {
      enableWhen(target, () => !isView && condition(), { resetOnDisable: !isView });
    };

    // -----------------------------------------------------------------------
    // Условные поля. Листья с собственным условием в групповые списки не входят,
    // чтобы два оператора не боролись за одну ноду.
    // -----------------------------------------------------------------------

    enableOn(model.$.installments, () => model.paymentType === 'installments');
    hideWhen(schema.node('installments'), () => model.paymentType !== 'installments');

    enableOn([model.$.personalData, model.$.passportData], isIndividual);
    enableOn(model.$.companyData, isCompany);
    hideWhen(schema.node('personal-section'), () => !isIndividual());
    hideWhen(schema.node('passport-section'), () => !isIndividual());
    hideWhen(schema.node('company-section'), () => !isCompany());

    enableOn(
      [
        model.$.vehicle.vin,
        model.$.vehicle.brand,
        model.$.vehicle.year,
        model.$.vehicle.mileage,
        model.$.vehicle.enginePower,
        model.$.vehicle.bodyType,
        model.$.vehicle.transmission,
        model.$.vehicle.licensePlate,
        model.$.vehicle.registrationCert,
        model.$.vehicle.hasAntiTheft,
        model.$.vehicle.garageParking,
        model.$.vehicle.usagePurpose,
        model.$.unlimitedDrivers,
      ],
      isVehicle
    );
    enableOn(model.$.vehicle.model, () => isVehicle() && model.vehicle.brand !== '');
    enableOn(model.$.vehicle.marketValue, () => model.insuranceType === 'casco');
    enableOn(model.$.vehicle.antiTheftBrand, () => isVehicle() && model.vehicle.hasAntiTheft);
    hideWhen(schema.node('vehicle-section'), () => !isVehicle());
    hideWhen(schema.node('vehicle.marketValue'), () => model.insuranceType !== 'casco');
    hideWhen(schema.node('vehicle.antiTheftBrand'), () => !model.vehicle.hasAntiTheft);

    enableOn(
      [
        model.$.property.type,
        model.$.property.address,
        model.$.property.area,
        model.$.property.floors,
        model.$.property.yearBuilt,
        model.$.property.wallMaterial,
        model.$.property.marketValue,
        model.$.property.hasAlarm,
        model.$.property.hasFireAlarm,
        model.$.property.ownershipDoc,
        model.$.propertyCoverageOptions,
      ],
      isProperty
    );
    enableOn(model.$.property.floor, () => isProperty() && model.property.type === 'apartment');
    hideWhen(schema.node('property-section'), () => !isProperty());
    hideWhen(schema.node('property.floor'), () => model.property.type !== 'apartment');

    enableOn(
      [
        model.$.health.height,
        model.$.health.weight,
        model.$.health.bloodPressure,
        model.$.health.isSmoker,
        model.$.health.hasChronicDiseases,
        model.$.health.hadSurgeries,
        model.$.health.occupation,
        model.$.health.isHighRiskJob,
        model.$.health.practicesSports,
        model.$.lifeCoverageOptions,
      ],
      isLife
    );
    enableOn(model.$.health.smokingYears, () => isLife() && model.health.isSmoker);
    enableOn(model.$.health.chronicDiseases, () => isLife() && model.health.hasChronicDiseases);
    enableOn(model.$.health.surgeries, () => isLife() && model.health.hadSurgeries);
    enableOn(model.$.health.extremeSports, () => isLife() && model.health.practicesSports);
    hideWhen(schema.node('health-section'), () => !isLife());
    hideWhen(schema.node('health.smokingYears'), () => !model.health.isSmoker);
    hideWhen(schema.node('health.chronicDiseases'), () => !model.health.hasChronicDiseases);
    hideWhen(schema.node('health.surgeries'), () => !model.health.hadSurgeries);
    hideWhen(schema.node('health.extremeSports'), () => !model.health.practicesSports);

    enableOn(
      [
        model.$.travel.destination,
        model.$.travel.tripPurpose,
        model.$.travel.departureDate,
        model.$.travel.returnDate,
        model.$.travel.isMultipleTrips,
        model.$.travelCoverageOptions,
      ],
      isTravel
    );
    hideWhen(schema.node('travel-section'), () => !isTravel());

    hideWhen(schema.node('drivers-section'), () => !isVehicle());
    hideWhen(schema.node('drivers-list'), () => model.unlimitedDrivers);
    hideWhen(schema.node('beneficiaries-section'), () => !isLife());
    hideWhen(schema.node('people-empty-note'), () => isVehicle() || isLife());

    enableOn(
      [model.$.previousInsurer, model.$.previousPolicyNumber, model.$.previousPolicyEndDate],
      () => model.hasPreviousInsurance
    );
    hideWhen(schema.node('previous-insurance'), () => !model.hasPreviousInsurance);
    hideWhen(schema.node('claims-list'), () => !model.hadClaims);

    // -----------------------------------------------------------------------
    // Вычисляемые поля
    // -----------------------------------------------------------------------

    compute(model.$.endDate, () => addMonths(model.startDate, model.insurancePeriod));
    compute(model.$.fullName, () =>
      [model.personalData.lastName, model.personalData.firstName, model.personalData.middleName]
        .filter(Boolean)
        .join(' ')
    );
    compute(model.$.age, () => fullYearsSince(model.personalData.birthDate));
    compute(model.$.health.bmi, () => {
      const { height, weight } = model.health;
      return height && weight ? round2(weight / (height / 100) ** 2) : null;
    });
    compute(model.$.travel.tripDuration, () =>
      daysBetween(model.travel.departureDate, model.travel.returnDate)
    );

    applyEach(model.$.drivers, driverRowBehavior);
    applyEach(model.$.beneficiaries, beneficiaryRowBehavior);
    exclusiveFlag(model.$.drivers, (row) => row.$.isMainDriver);

    compute(model.$.minDriverAge, () => {
      const ages = model.drivers
        .map((driver) => fullYearsSince(driver.birthDate))
        .filter((age): age is number => age !== null);
      return ages.length > 0 ? Math.min(...ages) : null;
    });
    compute(model.$.minDriverExperience, () => {
      const years = model.drivers
        .map((driver) => driver.drivingExperience)
        .filter((experience): experience is number => experience !== null);
      return years.length > 0 ? Math.min(...years) : null;
    });
    compute(model.$.totalBeneficiaryShare, () =>
      model.beneficiaries.length === 0
        ? null
        : model.beneficiaries
            .map((beneficiary) => beneficiary.share ?? 0)
            .reduce((sum, share) => sum + share, 0)
    );

    compute(model.$.basePremium, () =>
      calculateBasePremium(model.insuranceType, model.coverageAmount)
    );
    compute(model.$.ageCoefficient, () =>
      calculateAgeCoefficient(model.insuranceType, model.insuredType, model.age, model.minDriverAge)
    );
    compute(model.$.experienceCoefficient, () =>
      calculateExperienceCoefficient(
        model.insuranceType,
        model.unlimitedDrivers,
        model.minDriverExperience
      )
    );
    compute(model.$.regionCoefficient, () =>
      calculateRegionCoefficient(
        model.insuranceType,
        model.property.address.region,
        model.travel.destination
      )
    );
    // Пересчёт КБМ при изменении числа ДТП обеспечивает auto-tracking compute.
    compute(model.$.claimsCoefficient, () =>
      calculateClaimsCoefficient(
        model.drivers.map((driver) => driver.accidentsCount),
        model.claims.map((claim) => claim.atFault),
        model.hasPreviousInsurance
      )
    );
    compute(model.$.deductibleDiscount, () =>
      calculateDeductibleDiscount(model.deductible, model.coverageAmount)
    );
    compute(model.$.multiPolicyDiscount, () =>
      calculateMultiPolicyDiscount(model.hasPreviousInsurance)
    );
    compute(model.$.totalPremium, () =>
      calculateTotalPremium({
        basePremium: model.basePremium,
        ageCoefficient: model.ageCoefficient,
        experienceCoefficient: model.experienceCoefficient,
        regionCoefficient: model.regionCoefficient,
        claimsCoefficient: model.claimsCoefficient,
        riskFactor: calculateRiskFactor({
          type: model.insuranceType,
          vehicle: {
            enginePower: model.vehicle.enginePower,
            hasAntiTheft: model.vehicle.hasAntiTheft,
            garageParking: model.vehicle.garageParking,
            usagePurpose: model.vehicle.usagePurpose,
          },
          property: {
            hasAlarm: model.property.hasAlarm,
            hasFireAlarm: model.property.hasFireAlarm,
          },
          health: {
            isSmoker: model.health.isSmoker,
            hasChronicDiseases: model.health.hasChronicDiseases,
            isHighRiskJob: model.health.isHighRiskJob,
            extremeSports: model.health.extremeSports,
          },
        }),
        deductibleDiscount: model.deductibleDiscount,
        promoDiscount: model.promoDiscount,
        multiPolicyDiscount: model.multiPolicyDiscount,
      })
    );
    compute(model.$.installmentAmount, () =>
      calculateInstallmentAmount(model.totalPremium, model.paymentType, model.installments)
    );

    // -----------------------------------------------------------------------
    // Модели автомобиля зависят от марки. Модель сбрасывается, только если её нет
    // в списке новой марки: иначе загрузка заявки стирала бы сохранённое значение.
    // -----------------------------------------------------------------------

    onChange(model.$.vehicle.brand, async (brand, { signal }) => {
      const modelField = form.vehicle.model;
      if (!brand) {
        modelField.updateComponentProps({ options: [], placeholder: 'Сначала выберите марку' });
        return;
      }
      modelField.updateComponentProps({ options: [], placeholder: 'Загрузка моделей…' });
      try {
        const options = await loadCarModels(brand, signal);
        if (signal.aborted) return;
        modelField.updateComponentProps({ options, placeholder: 'Выберите модель' });
        if (!options.some((option) => option.value === model.vehicle.model)) {
          model.vehicle.model = '';
        }
      } catch {
        if (signal.aborted) return;
        modelField.updateComponentProps({
          options: [],
          placeholder: 'Не удалось загрузить модели',
        });
      }
    });

    // Просмотр не правит данные: ниже — только реакции режима редактирования.
    if (isView) return;

    // -----------------------------------------------------------------------
    // Маски: InputMask литералы не вставляет, значение форматируется здесь
    // -----------------------------------------------------------------------

    const applyMask = (target: Parameters<typeof transformValue<string>>[0], mask: string) => {
      transformValue(target, (value) => formatByMask(value ?? '', mask));
    };
    applyMask(model.$.phone, MASKS.phone);
    applyMask(model.$.companyData.inn, MASKS.inn);
    applyMask(model.$.companyData.ogrn, MASKS.ogrn);
    applyMask(model.$.companyData.kpp, MASKS.kpp);
    applyMask(model.$.passportData.series, MASKS.passportSeries);
    applyMask(model.$.passportData.number, MASKS.passportNumber);
    applyMask(model.$.electronicSignature, MASKS.smsCode);

    // -----------------------------------------------------------------------
    // Сброс массивов: resetOnDisable их не касается
    // -----------------------------------------------------------------------

    onChange(model.$.insuranceType, (type) => {
      if (!isVehicleInsurance(type)) model.drivers.clear();
      if (type !== 'life') model.beneficiaries.clear();
      if (type !== 'travel') model.travelers.clear();
    });
    onChange(model.$.unlimitedDrivers, (unlimited) => {
      if (unlimited) model.drivers.clear();
    });
    onChange(model.$.hadClaims, (hadClaims) => {
      if (!hadClaims) model.claims.clear();
    });

    // -----------------------------------------------------------------------
    // Промокод: скидка приходит с сервера
    // -----------------------------------------------------------------------

    onChange(
      model.$.promoCode,
      async (code, { signal }) => {
        if (!code.trim()) {
          model.promoDiscount = 0;
          return;
        }
        try {
          const { valid, discount } = await validatePromo(code, signal);
          if (signal.aborted) return;
          model.promoDiscount = valid ? Math.min(toPercent(discount), 15) : 0;
        } catch {
          if (!signal.aborted) model.promoDiscount = 0;
        }
      },
      { debounce: 300 }
    );

    // -----------------------------------------------------------------------
    // Предупреждения о вычисляемых значениях: поля не редактируются, поэтому их надо
    // пометить тронутыми, иначе замечание не показалось бы до перехода на следующий шаг.
    // -----------------------------------------------------------------------

    revalidateWhen([model.$.health.bmi, model.$.minDriverAge], () => {
      void validateModel(model, warningRules, { touch: true });
    });

    // -----------------------------------------------------------------------
    // Шаг подтверждения: серверный расчёт и СМС
    // -----------------------------------------------------------------------

    const smsActions = schema.node('sms-actions');
    let smsAttempts = 0;
    let smsSent = false;

    const sendSmsCode = async (): Promise<void> => {
      smsAttempts = 0;
      smsActions.patchProps({ hint: 'Отправляем код…' });
      try {
        await sendVerification(model.phone);
        smsSent = true;
        form.electronicSignature.clearIssues();
        smsActions.patchProps({
          hint: `Код отправлен на ${model.phone}. Демо-код: ${DEMO_SMS_CODE}`,
        });
      } catch (error) {
        smsActions.patchProps({
          hint: error instanceof Error ? error.message : 'Не удалось отправить код',
        });
      }
    };

    onComponentEvent(smsActions, 'onResend', () => void sendSmsCode());

    if (flow) {
      onChange(flow.current, async (step, { signal }) => {
        if (step !== CONFIRMATION_STEP) return;
        if (!smsSent) void sendSmsCode();
        try {
          const premium = await calculatePremium(model.get(), signal);
          if (signal.aborted) return;
          model.patch({
            basePremium: premium.basePremium,
            ageCoefficient: premium.ageCoefficient,
            experienceCoefficient: premium.experienceCoefficient,
            regionCoefficient: premium.regionCoefficient,
            claimsCoefficient: premium.claimsCoefficient,
            deductibleDiscount: toPercent(premium.deductibleDiscount),
            promoDiscount: toPercent(premium.promoDiscount),
            multiPolicyDiscount: toPercent(premium.multiPolicyDiscount),
            totalPremium: premium.totalPremium,
          });
        } catch {
          // Сервер недоступен: на экране остаётся локальный расчёт.
        }
      });
    }

    // -----------------------------------------------------------------------
    // Отправка: вызывается только после успешной проверки всей формы
    // -----------------------------------------------------------------------

    onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: Form) => {
      onSubmitError(null);
      try {
        onSubmitted(await createApplication(values));
      } catch (error) {
        if (error instanceof InvalidSmsCodeError) {
          smsAttempts += 1;
          const code =
            smsAttempts >= MAX_SMS_ATTEMPTS
              ? 'electronicSignature.exhausted'
              : 'electronicSignature.invalid';
          form.electronicSignature.setIssues([
            { code, params: { attempts: smsAttempts, maxAttempts: MAX_SMS_ATTEMPTS } },
          ]);
          form.electronicSignature.markAsTouched();
          return;
        }
        onSubmitError(
          error instanceof Error ? error.message : 'Не удалось отправить заявку. Повторите отправку'
        );
      }
    });
  });
