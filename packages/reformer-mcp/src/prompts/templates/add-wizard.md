Ты превращаешь single-form в multi-step wizard на `@reformer/cdk`.

## Шаги (из требований)
{{steps}}

## Текущий код формы
```typescript
{{code}}
```

## @reformer/core: Multi-step стратегия (STEP_VALIDATIONS, validateForm)

{{multiStep}}

## @reformer/cdk: FormWizard compound API

{{formWizard}}

### Recipes — conditional steps, externally-controlled wizard

{{cdkRecipes}}

---

## Задание

1. **Раздели существующие поля по шагам** согласно описанию. Не переименовывай поля — только группировка визуальная.
2. **Создай `STEPS` массив** с конфигурацией: `{ name, title, icon?, component }`. `component` — отдельный React-компонент с полями данного шага.
3. **STEP_VALIDATIONS map** — `{ <stepName>: (path) => { /* validate(...) для полей этого шага */ } }`. На `goToNextStep()` будет валидация только этого шага.
4. **`fullValidation`** — отдельная функция, которая валидирует ВСЁ (включая cross-step правила) — вызывается перед submit.
5. **Wrapping JSX**:
   ```tsx
   <FormWizard form={form} steps={STEPS} stepValidations={STEP_VALIDATIONS} fullValidation={fullValidation}>
     <FormWizard.Indicator />
     {STEPS.map(s => <FormWizard.Step key={s.name} name={s.name}><s.component /></FormWizard.Step>)}
     <FormWizard.Actions onSubmit={handleSubmit}>
       <FormWizard.Prev>Назад</FormWizard.Prev>
       <FormWizard.Next>Далее</FormWizard.Next>
       <FormWizard.Submit>Отправить</FormWizard.Submit>
     </FormWizard.Actions>
   </FormWizard>
   ```
6. **Условные шаги** — управляй через `steps` prop динамически (фильтрация массива) либо через `useRef<FormWizardHandle>().goToStep(n)` если переход не линейный.
7. **Не дублируй валидацию** — если поле есть в `STEP_VALIDATIONS`, не повторяй то же правило в `fullValidation` (используй `apply([...])` для повторного использования).

## 🎨 Визуальная плотность wizard'а (target visual baseline)

Сравнение с baseline-формой: minimum-viable wizard (просто чипсы 1-6 + Назад/Далее) выглядит дёшево и **отстаёт по плотности от реальных credit-form-пейджей**. Включай ВСЕ следующие элементы:

### Step indicator strip — клик на завершённую главу = переход

Чипсы должны быть `<button>` с `onClick`, не просто `<div>`. Клик на завершённый шаг (или ≤ текущего) → переход назад. Клик на ещё не достигнутый шаг — disabled / no-op.

```tsx
import { Coins, User, Phone, Briefcase, FileText, CheckSquare } from 'lucide-react';

const STEP_META: Array<{ n: number; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { n: 1, label: 'Кредит', icon: Coins },
  { n: 2, label: 'Данные', icon: User },
  { n: 3, label: 'Контакты', icon: Phone },
  { n: 4, label: 'Работа', icon: Briefcase },
  { n: 5, label: 'Доп. инфо', icon: FileText },
  { n: 6, label: 'Подтверждение', icon: CheckSquare },
];

function StepIndicator({ current, completed, maxReached, onJump }: {
  current: number; completed: Set<number>; maxReached: number;
  onJump: (n: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2 mb-6 overflow-x-auto pb-1" data-testid="step-indicator">
      {STEP_META.map(({ n, label, icon: Icon }, i) => {
        const isCurrent = n === current;
        const isCompleted = completed.has(n);
        const canJump = isCompleted || n <= maxReached;
        const cls = isCurrent
          ? 'bg-blue-600 text-white shadow-sm'
          : isCompleted
            ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
            : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed';
        return (
          <React.Fragment key={n}>
            <li>
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && onJump(n)}
                data-testid={`step-chip-${n}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${cls}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="opacity-70">{n}</span>
              </button>
            </li>
            {i < STEP_META.length - 1 && (
              <li className="text-gray-300" aria-hidden>—</li>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
```

### Step section card wrap

Каждая step-секция оборачивается в **white card** (не просто `<section>` без фона). Общий контейнер страницы — `max-w-4xl mx-auto p-6 space-y-6`. Step section — `bg-white border rounded-xl shadow-sm p-6 space-y-4`.

### Footer с прогресс-баром

Под кнопками навигации рендери прогресс-текст. Это даёт пользователю чувство «где я и сколько осталось».

```tsx
<div className="text-sm text-center text-gray-500" data-testid="step-progress">
  Шаг {currentStep} из {TOTAL_STEPS} • {Math.round((currentStep - 1) / (TOTAL_STEPS - 1) * 100)}% завершено
</div>
```

### Кнопки навигации

```tsx
<div className="flex items-center justify-between gap-3 pt-4 border-t">
  {currentStep > 1
    ? <Button type="button" variant="outline" onClick={goBack} data-testid="wizard-prev">← Назад</Button>
    : <span aria-hidden />}
  {currentStep < TOTAL_STEPS
    ? <Button type="button" onClick={goNext} data-testid="wizard-next" disabled={isValidating}>{isValidating ? 'Проверка...' : 'Далее →'}</Button>
    : <Button type="submit" onClick={handleSubmit} data-testid="wizard-submit" disabled={isSubmitting}>{isSubmitting ? 'Отправка...' : 'Отправить'}</Button>}
</div>
```

### testId convention для wizard

- `step-indicator` — корневой `<ol>`.
- `step-chip-{N}` — каждая chip-button. Атрибуты `data-current`, `data-completed` для assertions.
- `step-progress` — текст прогресса.
- `wizard-prev`, `wizard-next`, `wizard-submit` — кнопки навигации.

В конце — короткий чек-лист «STEPS / step validations / submit / условная навигация / визуальная плотность (icons, dashes, card wrap, progress, clickable chips)».