/**
 * Локали кита: словари, три вида поставки, умолчания каталога и строки компонентов по языку.
 *
 * Переключение языка «на лету» (без перемонтирования, с сохранением состояния) проверяется в
 * браузере — юнит-тесты кита рендерят через `renderToStaticMarkup`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createLocaleLoader,
  I18nProvider,
  messageArguments,
  parseMessage,
  translateBuiltin,
  validateLocale,
} from '@reformer/core/i18n';
import { en as cdkEn } from '@reformer/cdk/locale/en';
import { ru as cdkRu } from '@reformer/cdk/locale/ru';
import {
  AsyncBoundaryEmpty,
  AsyncBoundaryError,
  AsyncBoundaryLoading,
} from '@/components/async-boundary';
import { FormArray } from '@/components/form-array';
import { FormWizardActions, FormWizardProgress, StepIndicator } from '@/components/form-wizard';
import { SelectMulti } from '@/components/select';
import { en } from '../locale/en';
import { KIT_LOCALES, loadKitLocale } from '../locale/index';
import { ru } from '../locale/ru';
import kitEn from './en.json';
import { messageDefault, type KitMessageKey } from './message-default';
import kitRu from './ru.json';

const tRu = (key: KitMessageKey, values?: Record<string, string | number>) =>
  translateBuiltin(ru, kitEn, key, values);
const tEn = (key: KitMessageKey, values?: Record<string, string | number>) =>
  translateBuiltin(en, kitEn, key, values);

describe('словари кита', () => {
  it('русский словарь повторяет английский: те же ключи, разбор, те же аргументы', () => {
    expect(validateLocale(kitRu, kitEn)).toEqual([]);
    expect(validateLocale(kitEn)).toEqual([]);
  });

  it('все ключи — в пространстве имён kit.<компонент>.<имя>', () => {
    for (const key of Object.keys(kitEn)) {
      expect(key).toMatch(/^kit\.[a-z][A-Za-z]*\.[a-z][A-Za-z]*$/);
    }
  });

  it('локаль накопительная: словари ядра и cdk плюс подписи кита', () => {
    expect(ru.code).toBe('ru');
    expect(ru.weekStartsOn).toBe(cdkRu.weekStartsOn);
    expect(ru.messages).toEqual({ ...cdkRu.messages, ...kitRu });
    expect(en.messages).toEqual({ ...cdkEn.messages, ...kitEn });
    // Ядро и cdk внутри: ошибка валидации и строка загрузки файлов.
    expect(ru.messages['validation.required']).toBe('Обязательное поле');
    expect(ru.messages['cdk.fileUpload.cleared']).toBe('Список файлов очищен');
  });

  it('русские строки посимвольно совпадают с прежними зашитыми умолчаниями', () => {
    expect(tRu('kit.formWizard.prev')).toBe('← Назад');
    expect(tRu('kit.formWizard.next')).toBe('Далее →');
    expect(tRu('kit.formWizard.submit')).toBe('Отправить');
    expect(tRu('kit.formWizard.validating')).toBe('Проверка...');
    expect(tRu('kit.formWizard.submitting')).toBe('Отправка...');
    expect(tRu('kit.formWizard.progress', { current: 2, total: 6, percent: 33 })).toBe(
      'Шаг 2 из 6 • 33% завершено'
    );
    expect(tRu('kit.formWizard.stepsNav')).toBe('Шаги формы');
    expect(tRu('kit.formArray.add')).toBe('+ Добавить');
    expect(tRu('kit.formArray.remove')).toBe('Удалить');
    expect(tRu('kit.formArray.item')).toBe('Элемент');
    expect(tRu('kit.formArray.moveUp')).toBe('Переместить вверх');
    expect(tRu('kit.formArray.moveDown')).toBe('Переместить вниз');
    expect(tRu('kit.formField.hintLabel', { label: 'Email' })).toBe('Подсказка: Email');
    expect(tRu('kit.formField.validating')).toBe('Проверка...');
    expect(tRu('kit.asyncBoundary.loadingTitle')).toBe('Загрузка данных...');
    expect(tRu('kit.asyncBoundary.loadingSubtitle')).toBe('Пожалуйста, подождите');
    expect(tRu('kit.asyncBoundary.errorTitle')).toBe('Ошибка загрузки');
    expect(tRu('kit.asyncBoundary.retry')).toBe('Повторить');
    expect(tRu('kit.asyncBoundary.emptyTitle')).toBe('Нет данных');
    expect(tRu('kit.fileUpload.choose')).toBe('Выбрать файлы');
    expect(tRu('kit.fileUpload.dropzone')).toBe('Перетащите файлы или нажмите для выбора');
    expect(tRu('kit.fileUpload.inputPlaceholder')).toBe('Выберите файлы…');
    expect(tRu('kit.fileUpload.clear')).toBe('Очистить выбранные файлы');
    expect(tRu('kit.fileUpload.avatarLabel')).toBe('Загрузить изображение');
    expect(tRu('kit.fileUpload.error')).toBe('Ошибка');
    expect(tRu('kit.select.selected', { count: 4 })).toBe('Выбрано: 4');
    expect(tRu('kit.select.loading')).toBe('Загрузка...');
    expect(tRu('kit.select.loadError')).toBe('Не удалось загрузить опции.');
    expect(tRu('kit.combobox.create', { value: 'vue' })).toBe('Создать «vue»');
    expect(tRu('kit.combobox.treePlaceholder')).toBe('Выберите файл...');
    expect(tRu('kit.combobox.treePlaceholderMulti')).toBe('Выберите файлы...');
    expect(tRu('kit.combobox.search')).toBe('Поиск...');
    expect(tRu('kit.combobox.treeEmpty')).toBe('Ничего не найдено.');
  });

  it('подпись шага: признаки «текущий» и «завершён» независимы', () => {
    const step = (current: boolean, completed: boolean) => ({
      number: 2,
      title: 'Адрес',
      current: current ? 'yes' : 'no',
      completed: completed ? 'yes' : 'no',
    });
    expect(tRu('kit.formWizard.stepLabel', step(false, false))).toBe('Шаг 2: Адрес');
    expect(tRu('kit.formWizard.stepLabel', step(true, false))).toBe('Шаг 2: Адрес (текущий)');
    expect(tRu('kit.formWizard.stepLabel', step(false, true))).toBe('Шаг 2: Адрес (завершён)');
    expect(tRu('kit.formWizard.stepLabel', step(true, true))).toBe(
      'Шаг 2: Адрес (текущий) (завершён)'
    );
    expect(tEn('kit.formWizard.stepLabel', step(true, false))).toBe('Step 2: Адрес (current)');
  });
});

describe('loadKitLocale', () => {
  it('отдаёт тот же объект локали, что и синхронный модуль', async () => {
    expect(KIT_LOCALES).toEqual(['en', 'ru']);
    expect(await loadKitLocale('ru')).toBe(ru);
    expect(await loadKitLocale('en')).toBe(en);
    expect(await loadKitLocale('de')).toBeNull();
  });

  it('встаёт источником в createLocaleLoader; правки приложения ложатся поверх', async () => {
    const load = createLocaleLoader([
      loadKitLocale,
      () => ({ 'kit.formWizard.submit': 'Оформить' }),
    ]);
    const locale = await load('ru');
    expect(locale.messages['kit.formWizard.submit']).toBe('Оформить');
    expect(locale.messages['kit.formWizard.next']).toBe(kitRu['kit.formWizard.next']);
  });
});

describe('умолчания пропсов в каталоге', () => {
  interface CatalogProp {
    default?: unknown;
    'x-messageKey'?: string;
  }
  const catalog = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../component-catalog.json', import.meta.url)), 'utf8')
  ) as {
    components: { name: string; propsSchema?: { properties?: Record<string, CatalogProp> } }[];
  };

  const keyed = catalog.components.flatMap((component) =>
    Object.entries(component.propsSchema?.properties ?? {})
      .filter(([, prop]) => prop['x-messageKey'] !== undefined)
      .map(([name, prop]) => ({ where: `${component.name}.${name}`, prop }))
  );

  it('messageDefault отдаёт английскую строку словаря и её ключ', () => {
    expect(messageDefault('kit.select.placeholder')).toEqual({
      default: 'Select an option...',
      'x-messageKey': 'kit.select.placeholder',
    });
  });

  it('каждое умолчание с x-messageKey — существующий ключ, строка из en.json, без подстановок', () => {
    expect(keyed.length).toBeGreaterThan(30);
    for (const { where, prop } of keyed) {
      const key = prop['x-messageKey'] as KitMessageKey;
      expect(kitEn, where).toHaveProperty([key]);
      expect(prop.default, where).toBe(kitEn[key]);
      // Умолчание показывают как есть (документация, инспектор) — подстановкам там взяться неоткуда.
      expect([...messageArguments(parseMessage(kitEn[key]))], where).toEqual([]);
    }
  });

  it('у переведённых компонентов в каталоге не осталось русских умолчаний', () => {
    const translated =
      /^(AsyncBoundary|Combobox|FileUpload|FormArray|FormWizard|Select|StepIndicator)/;
    const cyrillic = catalog.components
      .filter((component) => translated.test(component.name))
      .flatMap((component) =>
        Object.entries(component.propsSchema?.properties ?? {})
          .filter(([, prop]) => typeof prop.default === 'string' && /[А-Яа-яЁё]/.test(prop.default))
          .map(([name, prop]) => `${component.name}.${name} = ${String(prop.default)}`)
      );
    expect(cyrillic).toEqual([]);
  });
});

describe('строки компонентов', () => {
  const actions = {
    prev: { onClick: () => {}, disabled: false },
    next: { onClick: () => {}, disabled: false },
    submit: { onClick: () => {}, disabled: false, isSubmitting: false },
    isFirstStep: false,
    isLastStep: false,
    isValidating: false,
    isSubmitting: false,
  };
  const progress = {
    current: 2,
    total: 6,
    percent: 33,
    completedCount: 1,
    isFirstStep: false,
    isLastStep: false,
  };
  const underRu = (node: React.ReactElement) =>
    renderToStaticMarkup(<I18nProvider locale={ru}>{node}</I18nProvider>);

  it('без I18nProvider подписи английские', () => {
    const html = renderToStaticMarkup(<FormWizardActions {...actions} />);
    expect(html).toContain('← Back');
    expect(html).toContain('Next →');
    expect(renderToStaticMarkup(<FormWizardActions {...actions} isLastStep />)).toContain('Submit');
    expect(renderToStaticMarkup(<FormWizardProgress {...progress} />)).toContain(
      'Step 2 of 6 • 33% complete'
    );
    expect(renderToStaticMarkup(<AsyncBoundaryLoading />)).toContain('Loading data...');
    expect(renderToStaticMarkup(<AsyncBoundaryError onRetry={() => {}} />)).toContain('Retry');
    expect(renderToStaticMarkup(<AsyncBoundaryEmpty />)).toContain('No data');
    expect(renderToStaticMarkup(<FormArray title="Phones" />)).toContain('+ Add');
  });

  it('под русской локалью — русские', () => {
    const html = underRu(<FormWizardActions {...actions} />);
    expect(html).toContain('← Назад');
    expect(html).toContain('Далее →');
    expect(underRu(<FormWizardActions {...actions} isLastStep />)).toContain('Отправить');
    expect(underRu(<FormWizardActions {...actions} isValidating />)).toContain('Проверка...');
    expect(underRu(<FormWizardProgress {...progress} />)).toContain('Шаг 2 из 6 • 33% завершено');
    expect(underRu(<AsyncBoundaryLoading />)).toContain('Пожалуйста, подождите');
    expect(underRu(<AsyncBoundaryError onRetry={() => {}} />)).toContain('Ошибка загрузки');
    expect(underRu(<AsyncBoundaryEmpty />)).toContain('Нет данных');
    expect(underRu(<FormArray title="Телефоны" />)).toContain('+ Добавить');
    expect(
      underRu(<SelectMulti value={['a', 'b', 'c', 'd']} onChange={() => {}} options={[]} />)
    ).toContain('Выбрано: 4');
  });

  it('явный проп важнее локали', () => {
    const html = underRu(
      <FormWizardActions {...actions} nextLabel="Продолжить" isLastStep={false} />
    );
    expect(html).toContain('Продолжить');
    expect(html).not.toContain('Далее →');
    expect(
      underRu(<AsyncBoundaryLoading title="Загружаем заявку…" subtitle={null} />)
    ).not.toContain('Пожалуйста, подождите');
  });

  it('индикатор шагов: подписи шага и контейнера по языку', () => {
    const steps = [
      {
        number: 1,
        title: 'Данные',
        icon: '1',
        isCurrent: false,
        isCompleted: true,
        canNavigate: true,
      },
      {
        number: 2,
        title: 'Адрес',
        icon: '2',
        isCurrent: true,
        isCompleted: false,
        canNavigate: true,
      },
    ];
    const indicator = {
      steps,
      goToStep: () => true,
      currentStep: 2,
      totalSteps: 2,
      completedSteps: [1],
    };
    const english = renderToStaticMarkup(<StepIndicator {...indicator} />);
    expect(english).toContain('aria-label="Form steps"');
    expect(english).toContain('aria-label="Step 1: Данные (completed)"');
    expect(english).toContain('aria-label="Step 2: Адрес (current)"');

    const russian = underRu(<StepIndicator {...indicator} />);
    expect(russian).toContain('aria-label="Шаги формы"');
    expect(russian).toContain('aria-label="Шаг 1: Данные (завершён)"');
    expect(russian).toContain('aria-label="Шаг 2: Адрес (текущий)"');
  });
});
