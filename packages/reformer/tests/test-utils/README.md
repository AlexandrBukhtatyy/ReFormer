# Помощники тестов

Общие помощники пакета `@reformer/core`. Импорт — явным путём к модулю (`test-utils/async`),
без barrel-файла: barrel обрастает никем не используемыми экспортами.

| Модуль                 | Что даёт                                                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`             | `ComponentInstance` — тип-заглушка для поля `component` в тестовых схемах                                                                                                                                                                                        |
| `form-from-fields.ts`  | `formFromFields` (форма), `arrayFromFields` (массив под-форм), `fieldOf` (нода поля) из компактного описания «значение и компонент рядом». Поле, чьё значение само объект вида `{ value }`, помощник примет за группу — такую форму собирайте напрямую из модели |
| `dispose-form.ts`      | `disposeForm(form)` — снять подписки формы (`dispose` не входит в контракт `FormGroup`)                                                                                                                                                                          |
| `async.ts`             | `tick(ms)`, `flushMicrotasks(n)`, `settle()`, `deferred()`, `useFakeClock(now?)`, `advance(ms)`                                                                                                                                                                  |
| `issues.ts`            | `issueCodes(node)`, `resultCodes(result, handle)` — коды замечаний для утверждений                                                                                                                                                                               |
| `stubs.ts`             | `stub(name)` и готовые `InputStub`, `SelectStub`, `SectionStub`, … с `displayName`                                                                                                                                                                               |
| `rule-table.ts`        | `checkRule` / `describeRule` — табличные кейсы правил валидации                                                                                                                                                                                                  |
| `property.ts`          | `propertyParams(runs)` — параметры fast-check с `FC_SEED` / `FC_NUM_RUNS`                                                                                                                                                                                        |
| `effect-tracker.ts`    | `trackEffects` + `liveEffects()` — счёт живых effect'ов для тестов утечек                                                                                                                                                                                        |
| `react.tsx`            | реэкспорт testing-library, `renderHookCounting`, `StrictWrapper` (DOM-тесты)                                                                                                                                                                                     |
| `compiled-snapshot.ts` | `describeCompiled(compiled, { rows? })` — детерминированное описание `CompiledSchema` для снапшотов и сравнения компиляций: ключи строк нормализованы в `row#0`, `row#1`…, функции, ручки и сигналы — метками                                                    |
| `schema-harness.ts`    | `mountScope(scope, nodes)` → `isHidden` / `propsOf` / `fire` / `unmount` — правила узлов схемы глазами рендерера, без React: эффекты `renderEffect`, затем `onMount`; `setHidden` главнее `hideWhen`                                                             |

```typescript
import { tick } from '../../test-utils/async';
import { InputStub } from '../../test-utils/stubs';
import { formFromFields } from '../../test-utils/form-from-fields';

const form = formFromFields<{ email: string; address: { city: string } }>({
  email: { value: '', component: InputStub as never },
  address: { city: { value: '' } },
});
```

Если один и тот же код повторяется в нескольких тестовых файлах — выносите его сюда отдельным
модулем.
