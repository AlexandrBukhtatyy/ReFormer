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
model.get();                 // снимок { email, address: { city }, ... } — для submit
```

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
