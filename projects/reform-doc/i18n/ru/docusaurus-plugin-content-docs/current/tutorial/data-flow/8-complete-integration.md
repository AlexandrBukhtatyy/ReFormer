---
sidebar_position: 8
---

# Полная интеграция

Объединение всех функций Data Flow в готовый к производству компонент формы.

## Что мы построили

На протяжении этого раздела мы создали:

1. **Загрузка начальных данных** - Загрузка из API, localStorage, с приоритетами
2. **Автосохранение** - Автоматическое сохранение с debounce и индикатором статуса
3. **Управление черновиками** - Создание, загрузка, обновление, удаление черновиков
4. **Сброс и очистка** - Возврат к исходным значениям или очистка всех данных
5. **Предзаполнение данных** - Предварительное заполнение из профиля пользователя с умным объединением
6. **Преобразование данных** - Двусторонняя конвертация между форматами формы и API

Теперь объединим всё в полный, готовый к производству компонент формы.

## Полный компонент формы

Вот полная интеграция:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState, useEffect } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { useDataLoader } from '@/hooks/useDataLoader';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useDraftManager } from '@/hooks/useDraftManager';
import { useFormReset } from '@/hooks/useFormReset';
import { useDataPrefill } from '@/hooks/useDataPrefill';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { creditApplicationTransformer } from '@/services/transformers/credit-application.transformer';
import { draftTransformer } from '@/services/transformers/draft.transformer';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';
import { DraftSelector } from '@/components/DraftSelector';
import { ResetControls } from '@/components/ResetControls';
import { PrefillWithPreview } from '@/components/PrefillWithPreview';
import { LoadingBoundary } from '@/components/LoadingBoundary';
import { FormRenderer } from '@/components/FormRenderer';

interface CreditApplicationFormProps {
  /** ID заявления для редактирования существующего */
  applicationId?: string;
  /** ID черновика для загрузки сохранённого */
  draftId?: string;
  /** Вызывается при успешной отправке */
  onSubmitSuccess?: (data: any) => void;
  /** Вызывается при отмене пользователем */
  onCancel?: () => void;
}

export function CreditApplicationForm({
  applicationId,
  draftId,
  onSubmitSuccess,
  onCancel,
}: CreditApplicationFormProps) {
  // ============================================
  // 1. СОЗДАНИЕ ФОРМЫ
  // ============================================
  const form = useMemo(() => createCreditApplicationForm(), []);

  // ============================================
  // 2. ЗАГРУЗКА ДАННЫХ
  // ============================================
  const { loading, error: loadError } = useDataLoader(form, applicationId);

  // Загрузка черновика если предоставлен
  useEffect(() => {
    if (draftId && !applicationId) {
      const draft = getDraftById(draftId);
      if (draft) {
        const formData = draftTransformer.deserialize(draft.data);
        form.patchValue(formData);
      }
    }
  }, [draftId, applicationId, form]);

  // ============================================
  // 3. УПРАВЛЕНИЕ ЧЕРНОВИКАМИ
  // ============================================
  const draftManager = useDraftManager(form);

  // ============================================
  // 4. АВТОСОХРАНЕНИЕ
  // ============================================
  const { status: saveStatus, pause: pauseAutoSave, resume: resumeAutoSave } = useAutoSave(form, {
    debounce: 30000, // 30 секунд
    saveFn: async (formData) => {
      // Сериализация с преобразователем для черновика (сохраняет вычисляемые поля)
      const draftData = draftTransformer.serialize(formData);

      // Обновление текущего черновика или создание нового
      if (draftManager.currentDraftId) {
        draftManager.updateCurrent({ data: draftData });
      } else {
        const timestamp = new Date().toLocaleString();
        draftManager.create(`Автосохранено ${timestamp}`, 'Автоматически сохранено');
      }
    },
  });

  // ============================================
  // 5. СБРОС И ОЧИСТКА
  // ============================================
  const { reset, clear } = useFormReset(form);

  const handleReset = async () => {
    const success = await reset();
    if (success) {
      // Опционально: очищаем текущий черновик
      if (!applicationId) {
        draftManager.clearCurrent();
      }
    }
  };

  const handleClear = async () => {
    const success = await clear();
    if (success) {
      draftManager.clearCurrent();
    }
  };

  // ============================================
  // 6. ПРЕДЗАПОЛНЕНИЕ ДАННЫХ
  // ============================================
  const { state: prefillState, preview, loadPreview, apply: applyPrefill, cancel: cancelPrefill } = useDataPrefill(form);

  // ============================================
  // 7. ОТПРАВКА ФОРМЫ
  // ============================================
  const { submit, submitting, error: submitError } = useFormSubmission(form);

  const handleSubmit = async () => {
    // Приостановка автосохранения во время отправки
    pauseAutoSave();

    try {
      const success = await submit();

      if (success) {
        // Удаление черновика после успешной отправки
        if (draftManager.currentDraftId) {
          draftManager.remove(draftManager.currentDraftId);
        }

        // Уведомление родителя
        onSubmitSuccess?.(form.value.value);
      }
    } finally {
      // Возобновление автосохранения
      resumeAutoSave();
    }
  };

  // ============================================
  // 8. ОПЕРАЦИИ С ЧЕРНОВИКАМИ
  // ============================================
  const handleLoadDraft = (id: string) => {
    // Приостановка автосохранения при загрузке
    pauseAutoSave();

    // Загрузка черновика
    draftManager.load(id);

    // Возобновление автосохранения
    setTimeout(() => resumeAutoSave(), 100);
  };

  const handleSaveAsNewDraft = (name: string, description?: string) => {
    // Создание нового черновика
    const draft = draftManager.create(name, description);

    // Показ сообщения об успехе
    console.log('Черновик сохранён:', draft.name);
  };

  // ============================================
  // 9. ОТРИСОВКА
  // ============================================

  return (
    <LoadingBoundary loading={loading} error={loadError}>
      <div className="credit-application-form">
        {/* ========== ЗАГОЛОВОК ========== */}
        <header className="form-header">
          <div className="form-title">
            <h1>
              {applicationId
                ? 'Редактирование кредитного заявления'
                : 'Новое кредитное заявление'}
            </h1>
            {draftManager.currentDraft && (
              <span className="draft-badge">
                Черновик: {draftManager.currentDraft.name}
              </span>
            )}
          </div>

          {/* Панель управления */}
          <div className="form-controls">
            {/* Кнопка предзаполнения */}
            <PrefillWithPreview form={form} />

            {/* Индикатор автосохранения */}
            <AutoSaveIndicator status={saveStatus} />

            {/* Выбор черновика */}
            <DraftSelector
              drafts={draftManager.drafts}
              currentDraftId={draftManager.currentDraftId}
              onLoad={handleLoadDraft}
              onDelete={draftManager.remove}
              onDuplicate={draftManager.duplicate}
              onCreateNew={handleSaveAsNewDraft}
            />

            {/* Управление сбросом */}
            <ResetControls
              form={form}
              onReset={handleReset}
              onClear={handleClear}
            />
          </div>
        </header>

        {/* ========== СОДЕРЖИМОЕ ФОРМЫ ========== */}
        <div className="form-content">
          <FormRenderer form={form} />
        </div>

        {/* ========== НИЖНЯЯ ЧАСТЬ ========== */}
        <footer className="form-footer">
          <div className="form-actions">
            {/* Кнопка отмены */}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="button-secondary"
                disabled={submitting}
              >
                Отмена
              </button>
            )}

            {/* Кнопка сохранения как черновик */}
            <button
              type="button"
              onClick={() => {
                const name = prompt('Введите имя черновика:');
                if (name) {
                  handleSaveAsNewDraft(name);
                }
              }}
              className="button-secondary"
              disabled={submitting}
            >
              Сохранить как черновик
            </button>

            {/* Кнопка отправки */}
            <button
              type="button"
              onClick={handleSubmit}
              className="button-primary"
              disabled={submitting || !form.isValid.value}
            >
              {submitting ? 'Отправка...' : 'Отправить заявление'}
            </button>
          </div>

          {/* Ошибка отправки */}
          {submitError && (
            <div className="error-message">
              <ErrorIcon className="w-5 h-5" />
              <span>{submitError.message}</span>
            </div>
          )}

          {/* Статус формы */}
          <div className="form-status">
            <span className={form.isDirty.value ? 'text-orange-600' : 'text-gray-500'}>
              {form.isDirty.value ? 'Несохранённые изменения' : 'Без изменений'}
            </span>
            <span className="separator">•</span>
            <span className={form.isValid.value ? 'text-green-600' : 'text-red-600'}>
              {form.isValid.value ? 'Валидна' : 'Невалидна'}
            </span>
          </div>
        </footer>

        {/* ========== ДИАЛОГ ПРЕДПРОСМОТРА ПРЕДЗАПОЛНЕНИЯ ========== */}
        {prefillState === 'preview' && preview && (
          <PrefillPreviewDialog
            preview={preview}
            onApply={() => {
              applyPrefill();
            }}
            onCancel={cancelPrefill}
          />
        )}
      </div>
    </LoadingBoundary>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
    </svg>
  );
}
```

## Компонент панели управления

Извлечём панель управления для переиспользования:

```tsx title="src/components/ControlPanel.tsx"
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { DraftSelector } from './DraftSelector';
import { ResetControls } from './ResetControls';
import { PrefillButton } from './PrefillButton';
import type { FormNode } from 'reformer';
import type { SaveStatus } from '@/hooks/useAutoSave';
import type { UseDraftManagerReturn } from '@/hooks/useDraftManager';

interface ControlPanelProps {
  form: FormNode;
  saveStatus: SaveStatus;
  draftManager: UseDraftManagerReturn;
  onReset: () => void;
  onClear: () => void;
}

export function ControlPanel({
  form,
  saveStatus,
  draftManager,
  onReset,
  onClear,
}: ControlPanelProps) {
  return (
    <div className="control-panel">
      {/* Предзаполнение */}
      <div className="control-group">
        <label>Данные</label>
        <PrefillButton form={form} />
      </div>

      {/* Автосохранение */}
      <div className="control-group">
        <label>Автосохранение</label>
        <AutoSaveIndicator status={saveStatus} />
      </div>

      {/* Черновики */}
      <div className="control-group">
        <label>Черновики</label>
        <DraftSelector
          drafts={draftManager.drafts}
          currentDraftId={draftManager.currentDraftId}
          onLoad={draftManager.load}
          onDelete={draftManager.remove}
          onDuplicate={draftManager.duplicate}
          onCreateNew={draftManager.create}
        />
      </div>

      {/* Сброс */}
      <div className="control-group">
        <label>Сброс</label>
        <ResetControls
          form={form}
          onReset={onReset}
          onClear={onClear}
        />
      </div>
    </div>
  );
}
```

## Примеры использования

### Пример 1: Новое заявление

```tsx
<CreditApplicationForm
  onSubmitSuccess={(data) => {
    console.log('Заявление отправлено:', data);
    navigate('/success');
  }}
  onCancel={() => {
    navigate('/dashboard');
  }}
/>
```

### Пример 2: Редактирование существующего заявления

```tsx
<CreditApplicationForm
  applicationId="app-123"
  onSubmitSuccess={(data) => {
    console.log('Заявление обновлено:', data);
    navigate('/applications');
  }}
/>
```

### Пример 3: Загрузка черновика

```tsx
<CreditApplicationForm
  draftId="draft-456"
  onSubmitSuccess={(data) => {
    console.log('Черновик отправлен:', data);
    navigate('/success');
  }}
/>
```

### Пример 4: Интеграция с маршрутизатором

```tsx
import { useParams, useNavigate } from 'react-router-dom';

function ApplicationPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <CreditApplicationForm
      applicationId={id}
      onSubmitSuccess={() => navigate('/success')}
      onCancel={() => navigate('/dashboard')}
    />
  );
}
```

## Полная диаграмма потока данных

```
┌─────────────────────────────────────────────────────────────────┐
│                    ФОРМА КРЕДИТНОГО ЗАЯВЛЕНИЯ                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     ИСТОЧНИКИ ДАННЫХ                      │  │
│  │                                                            │  │
│  │  1. API (applicationId)                                   │  │
│  │     ├─> Загрузка существующего заявления                 │  │
│  │     └─> Преобразование: десериализация                   │  │
│  │                                                            │  │
│  │  2. localStorage (draftId)                                │  │
│  │     ├─> Загрузка сохранённого черновика                  │  │
│  │     └─> Преобразование: десериализация                   │  │
│  │                                                            │  │
│  │  3. Профиль пользователя                                  │  │
│  │     ├─> Предзаполнение личных данных                     │  │
│  │     └─> Умное объединение (не перезаписываем)            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     СОСТОЯНИЕ ФОРМЫ                       │  │
│  │                                                            │  │
│  │  • Observable значений                                    │  │
│  │  • Observable валидации                                   │  │
│  │  • Observable грязного состояния                          │  │
│  │  • Поведения (вычисляемые поля)                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ                  │  │
│  │                                                            │  │
│  │  • Заполнение/редактирование полей                       │  │
│  │  • Сброс/очистка                                         │  │
│  │  • Загрузка черновика                                    │  │
│  │  • Предзаполнение из профиля                             │  │
│  │  • Сохранение как черновик                               │  │
│  │  • Отправка                                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   АВТОСОХРАНЕНИЕ (30 сек)                │  │
│  │                                                            │  │
│  │  • Debounced сохранение                                  │  │
│  │  • Преобразование: сериализация (черновик)               │  │
│  │  • Сохранение в localStorage                             │  │
│  │  • Показ индикатора статуса                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   НАЗНАЧЕНИЯ ДАННЫХ                       │  │
│  │                                                            │  │
│  │  1. localStorage (автосохранение)                         │  │
│  │     └─> Черновик со всеми полями                         │  │
│  │                                                            │  │
│  │  2. API (отправка)                                        │  │
│  │     ├─> Преобразование: сериализация                     │  │
│  │     ├─> Удаление вычисляемых полей                       │  │
│  │     ├─> Нормализация данных                              │  │
│  │     └─> Отправка на сервер                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Тестирование полной интеграции

Комплексный контрольный список тестирования:

### Поток создания нового заявления
- [ ] Откройте форму без ID
- [ ] Форма начинается пустой
- [ ] Заполните некоторые поля
- [ ] Автосохранение создаёт черновик
- [ ] Смотрите статус "сохранение" → "сохранено"
- [ ] Перезагрузите страницу
- [ ] Черновик сохранится в селекторе
- [ ] Загрузите черновик
- [ ] Данные восстановлены
- [ ] Продолжите редактирование
- [ ] Отправьте форму
- [ ] Черновик удалён после отправки

### Поток редактирования существующего заявления
- [ ] Откройте форму с applicationId
- [ ] Смотрите спиннер загрузки
- [ ] Форма загружается с данными
- [ ] Поведения вычисляются
- [ ] Измените поля
- [ ] Автосохранение обновляется
- [ ] Отправьте изменения
- [ ] API получает обновления

### Поток предзаполнения
- [ ] Откройте новую форму
- [ ] Нажмите "Заполнить из профиля"
- [ ] Смотрите диалог предпросмотра
- [ ] Просмотрите изменения
- [ ] Примените предзаполнение
- [ ] Форма заполнена
- [ ] Можете редактировать предзаполненные данные
- [ ] Сохраните как черновик
- [ ] Черновик включает предзаполненные данные

### Поток сброса
- [ ] Загрузите черновик или заявление
- [ ] Измените поля
- [ ] Нажмите "Сброс"
- [ ] Диалог подтверждения появляется
- [ ] Подтвердите сброс
- [ ] Форма восстанавливает исходные
- [ ] Грязное состояние очищено
- [ ] Можете редактировать снова

### Поток управления черновиками
- [ ] Создайте несколько черновиков
- [ ] Переключайтесь между черновиками
- [ ] Каждый черновик сохраняет данные
- [ ] Дублируйте черновик
- [ ] Оба черновика существуют
- [ ] Удалите черновик
- [ ] Черновик удалён
- [ ] Другие черновики не затронуты

### Обработка ошибок
- [ ] Ошибка сети во время загрузки
- [ ] Смотрите сообщение об ошибке
- [ ] Можете повторить попытку
- [ ] Ошибка сети во время сохранения
- [ ] Автосохранение показывает ошибку
- [ ] Автоматически повторяет
- [ ] Ошибки валидации отправки
- [ ] Форма показывает ошибки
- [ ] Можете исправить и повторить отправку

## Соображения производительности

### 1. Debouncing

```typescript
// Debounce автосохранения
useAutoSave(form, {
  debounce: 30000, // 30 секунд - баланс между безопасностью и производительностью
});
```

### 2. Мемоизация

```typescript
// Мемоизация создания формы
const form = useMemo(() => createCreditApplicationForm(), []);

// Мемоизация дорогостоящих вычислений
const transformedData = useMemo(
  () => transformer.serialize(formData),
  [formData]
);
```

### 3. Ленивая загрузка

```typescript
// Ленивая загрузка списка черновиков
const [drafts, setDrafts] = useState<Draft[]>([]);
const [draftsLoaded, setDraftsLoaded] = useState(false);

const loadDrafts = useCallback(() => {
  if (!draftsLoaded) {
    setDrafts(getAllDrafts());
    setDraftsLoaded(true);
  }
}, [draftsLoaded]);
```

### 4. Очистка

```typescript
useEffect(() => {
  const autoSave = createAutoSave(form, options);

  return () => {
    // Очистка при размонтировании
    autoSave.destroy();
  };
}, [form]);
```

## Лучшие практики

### 1. Обработка ошибок
- Всегда обрабатывайте состояния загрузки и ошибок
- Показывайте понятные пользователю сообщения об ошибках
- Предоставляйте механизмы повтора
- Логируйте ошибки для отладки

### 2. Обратная связь пользователю
- Показывайте индикаторы загрузки
- Показывайте статус сохранения
- Подтверждайте деструктивные действия
- Отмечайте успехи

### 3. Целостность данных
- Валидируйте перед отправкой
- Преобразуйте последовательно
- Обрабатывайте граничные случаи
- Тестируйте полные циклы

### 4. Производительность
- Debounce дорогостоящих операций
- Мемоизируйте вычисления
- Ленивая загрузка где возможно
- Очищайте подписки

### 5. Пользовательский опыт
- Часто автосохраняйте
- Не блокируйте ввод пользователя
- Сохраняйте работу при ошибках
- Делайте действия обратимыми

## Структура файлов

Итоговая структура файлов:

```
src/
├── components/
│   ├── CreditApplicationForm.tsx       # Основной компонент формы
│   ├── ControlPanel.tsx                # Панель управления
│   ├── AutoSaveIndicator.tsx           # Индикатор статуса сохранения
│   ├── DraftSelector.tsx               # UI управления чернвками
│   ├── ResetControls.tsx               # Кнопки сброса
│   ├── PrefillButton.tsx               # Кнопка предзаполнения
│   ├── PrefillPreviewDialog.tsx        # Предпросмотр предзаполнения
│   ├── LoadingBoundary.tsx             # Состояния загрузки
│   ├── ConfirmDialog.tsx               # Диалоги подтверждения
│   └── FormRenderer.tsx                # Отрисовка формы
│
├── hooks/
│   ├── useDataLoader.ts                # Загрузка данных
│   ├── useAutoSave.ts                  # Автосохранение
│   ├── useDraftManager.ts              # Управление черновиками
│   ├── useFormReset.ts                 # Сброс/очистка
│   ├── useDataPrefill.ts               # Предзаполнение
│   └── useFormSubmission.ts            # Отправка
│
├── services/
│   ├── api/
│   │   ├── application.api.ts          # API заявлений
│   │   └── user-profile.api.ts         # API профиля
│   ├── storage/
│   │   └── draft.storage.ts            # localStorage
│   ├── transformers/
│   │   ├── credit-application.transformer.ts
│   │   ├── draft.transformer.ts
│   │   └── submission.transformer.ts
│   ├── auto-save.service.ts            # Логика автосохранения
│   └── data-transform.service.ts       # Утилиты преобразования
│
└── types/
    ├── draft.types.ts                  # Интерфейсы черновиков
    ├── transformer.types.ts            # Интерфейсы преобразователей
    └── user-profile.types.ts           # Интерфейсы профиля
```

## Резюме

Мы построили полный, готовый к производству компонент формы с:

### Загрузка данных
- Несколько источников (API, localStorage, профиль)
- Загрузка на основе приоритета
- Управление состоянием загрузки
- Обработка ошибок

### Автосохранение
- Debounced сохранение
- Индикация статуса
- Сохранение при выгрузке страницы
- Двойное хранилище (localStorage + API)

### Управление черновиками
- Создание, чтение, обновление, удаление
- Поддержка нескольких черновиков
- Переключение между черновиками
- Интеграция с автосохранением

### Сброс и очистка
- Возврат к исходным значениям
- Очистка всех данных
- Сброс на уровне этапа
- Сброс на уровне поля
- Диалоги подтверждения

### Предзаполнение данных
- Загрузка из профиля пользователя
- Умное объединение
- Предпросмотр изменений
- Выборочное предзаполнение

### Преобразование данных
- Двусторонняя конвертация
- Обработка дат
- Нормализация данных
- Удаление вычисляемых полей

### Отправка формы
- Валидация перед отправкой
- Преобразование для API
- Обработка ошибок
- Callbacks успеха

## Что дальше?

Теперь у вас есть полное понимание Data Flow в ReFormer! Вот предлагаемые следующие шаги:

1. **Изучите валидацию** - Изучите продвинутые паттерны валидации
2. **Изучите поведения** - Глубокое погружение в вычисляемые поля и зависимости
3. **Создавайте пользовательские хуки** - Создавайте специфичные для домена хуки потока данных
4. **Добавьте аналитику** - Отслеживайте взаимодействия формы и отказы
5. **Реализуйте журнал аудита** - Логируйте все изменения для соответствия
6. **Добавьте разрешение конфликтов** - Обрабатывайте одновременное редактирование
7. **Оптимизируйте производительность** - Профилируйте и улучшайте узкие места

## Поздравления!

Вы завершили учебник Data Flow. Теперь вы можете:

- Загружать данные из любого источника
- Автосохранять прогресс пользователя
- Управлять несколькими черновиками
- Сбрасывать и очищать формы
- Предзаполнять из профилей
- Преобразовывать форматы данных
- Надёжно отправлять формы

Ваша форма кредитного заявления теперь готова к производству с управлением потоком данных корпоративного уровня!
