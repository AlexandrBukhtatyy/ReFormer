## 16. READING FIELD VALUES (CRITICALLY IMPORTANT)

Под M1 значения живут в модели. Есть три контекста чтения: value-доступ модели, сигналы, и React-хуки.

### В React-компоненте — хуки

```typescript
// Полное состояние поля (объект)
const { value, errors, disabled, touched, shouldShowError } = useFormControl(control.email);

// Только значение (напрямую, БЕЗ деструктуризации!)
const email = useFormControlValue(control.email);

// Реактивная длина массива
const count = useArrayLength(control.items);
```

### Вне React — модель

```typescript
// value-доступ (реактивно внутри effect/computed, запись присваиванием)
model.email;                 // читать
model.email = 'a@b.c';       // писать
model.address.city;          // вложенное поле (model.address — под-модель FormModel<Address>)

// через сигнал (escape-hatch)
model.$.email.value;         // реактивное чтение/запись
model.$.email.peek();        // нереактивный снимок
model.$.address.city.value;  // сигнал вложенного поля (≡ model.address.$.city у под-модели)

// весь объект
model.get();                 // НЕреактивный снимок { email, address: { city }, ... } — для submit
```

> ⚠️ `model.get()` и `model.isDirty()` читают через `peek()` — внутри `effect`/`computed` они НЕ
> создают зависимостей. `computed(() => model.get())` никогда не пересчитается. Для реактивного
> чтения всего объекта — узел дерева `$` (ниже).

### Подписка на группу и на модель целиком

Каждый узел дерева `$` — сигнал: лист отдаёт `PathAwareSignal`, а корень, вложенные объекты-группы
и массивы — `ReadonlySignal` агрегированного значения поддерева. Поэтому подписаться можно на любом
уровне, а не только на конкретном поле.

```typescript
model.$.subscribe((all) => autosave(all));      // любое изменение модели; all: T целиком
model.$.address.subscribe((addr) => ...);       // только поддерево address
model.$.address.value;                          // реактивный снимок группы
model.$.address.peek();                         // нереактивный снимок группы
model.$.items.subscribe((rows) => ...);         // массив: и правка элемента, и push/removeAt/move

// узел — обычный ReadonlySignal, поэтому принимается операциями слоя данных
watchField(model.$.address, (addr) => geocode(addr));
```

Дети узла доступны как раньше — `model.$.address.city` по-прежнему сигнал поля. Подписчик вызывается
сразу с текущим значением (семантика `Signal.subscribe`), а `model.set(...)`/`model.reset()`
уведомляют один раз, а не по разу на поле.

> ⚠️ Доступ к полю выигрывает у свойства сигнала: если в форме есть поле с именем `value`, `peek`,
> `subscribe`, `valueOf`, `toString`, `toJSON` или `brand`, то `model.$.<группа>.<это имя>` вернёт
> сигнал поля. `subscribe` при этом продолжает работать.

### В behaviors — читаем model напрямую

`compute`/`onChange`/условия `when` читают значения из value-модели (`model.field`) —
подписка на сигналы происходит автоматически внутри реактивного эффекта.

```typescript
import { defineFormBehavior, compute, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model, form }) => {
  // читаем несколько полей — compute сам подпишется на прочитанные сигналы
  compute(model.$.fullName, () => `${model.firstName} ${model.lastName}`);

  // onChange: 1-й аргумент — новое значение; остальные поля берём из model
  onChange(model.$.loanAmount, (amount) => {
    const term = model.loanTerm;
    if (amount && term) {
      form.monthlyPayment.updateComponentProps({ hint: `≈ ${amount / term}` });
    }
  });
});
```

> Cross-field ЗАПИСЬ производного значения делай через `compute` (цель не входит в источники →
> цикла нет). Для side-эффектов (загрузка опций, обновление componentProps) — `onChange`.
> `computeFrom`/`copyFrom`/`enableWhen` принимают сигналы (`model.$.x`), НЕ строковые пути.
