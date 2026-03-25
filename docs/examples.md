# Примеры

Полные примеры использования ReFormer от простого к сложному.

## Жизненный цикл формы

```mermaid
sequenceDiagram
    participant Dev as Разработчик
    participant RF as ReFormer
    participant VR as ValidationRegistry
    participant BR as BehaviorRegistry
    participant React as React

    Dev->>RF: createForm(config)

    rect rgb(200, 220, 255)
        Note over RF: Инициализация
        RF->>RF: Создание узлов (FieldNode, GroupNode)
        RF->>VR: beginRegistration()
        RF->>VR: Регистрация валидаторов
        RF->>VR: endRegistration()
        RF->>VR: apply(form)
    end

    rect rgb(220, 255, 200)
        Note over RF: Behaviors
        RF->>BR: beginRegistration()
        RF->>BR: Регистрация behaviors
        RF->>BR: endRegistration()
        RF->>BR: apply(form) → effects
    end

    RF-->>Dev: FormProxy&lt;T&gt;

    rect rgb(255, 220, 200)
        Note over React: Runtime
        React->>RF: useFormControl(form.email)
        RF-->>React: { value, errors, ... }
        React->>RF: setValue("test")
        RF-->>React: Signal update
        React->>React: Re-render
    end
```

---

## Пример 1: Простая форма логина

```typescript
import { createForm, required, email, minLength } from 'reformer';
import { useFormControl } from 'reformer/react';

// 1. Интерфейс
interface LoginForm {
  email: string;
  password: string;
}

// 2. Создание формы
const form = createForm<LoginForm>({
  form: {
    email: { value: '', component: Input },
    password: { value: '', component: PasswordInput },
  },
  validation: (path) => {
    required(path.email);
    email(path.email);
    required(path.password);
    minLength(path.password, 8);
  },
});

// 3. React компонент
function LoginPage() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      const data = form.getValue();
      await api.login(data);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <EmailField control={form.email} />
      <PasswordField control={form.password} />
      <button type="submit" disabled={form.invalid.value}>
        Войти
      </button>
    </form>
  );
}

function EmailField({ control }: { control: FieldNode<string> }) {
  const { value, errors, touched } = useFormControl(control);

  return (
    <div>
      <input
        type="email"
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {touched && errors[0] && <span>{errors[0].message}</span>}
    </div>
  );
}
```

---

## Пример 2: Вычисляемые поля

```typescript
interface OrderForm {
  price: number;
  quantity: number;
  total: number;      // Вычисляемое
  discount: number;
  finalTotal: number; // Вычисляемое
}

const form = createForm<OrderForm>({
  form: {
    price: { value: 0, component: NumberInput },
    quantity: { value: 1, component: NumberInput },
    total: { value: 0, component: NumberInput, componentProps: { disabled: true } },
    discount: { value: 0, component: NumberInput },
    finalTotal: { value: 0, component: NumberInput, componentProps: { disabled: true } },
  },

  validation: (path) => {
    min(path.price, 0);
    min(path.quantity, 1);
    min(path.discount, 0);
    max(path.discount, 100);
  },

  behavior: (path) => {
    // total = price × quantity
    computeFrom(
      [path.price, path.quantity],
      path.total,
      (v) => v.price * v.quantity
    );

    // finalTotal = total - discount%
    computeFrom(
      [path.total, path.discount],
      path.finalTotal,
      (v) => v.total * (1 - v.discount / 100)
    );
  },
});
```

---

## Пример 3: Зависимые поля (страна → город)

```typescript
interface AddressForm {
  country: string;
  city: string;
}

const form = createForm<AddressForm>({
  form: {
    country: {
      value: '',
      component: Select,
      componentProps: { options: countries },
    },
    city: {
      value: '',
      component: Select,
      componentProps: { options: [], disabled: true },
    },
  },

  validation: (path) => {
    required(path.country);
    required(path.city);
  },

  behavior: (path) => {
    // Город активен только если выбрана страна
    enableWhen(path.city, (form) => Boolean(form.country));

    // При изменении страны — загрузить города
    watchField(path.country, async (country, ctx) => {
      if (country) {
        const cities = await api.getCities(country);
        ctx.updateComponentProps(path.city, { options: cities });
        ctx.form.city.setValue(''); // Сбросить выбранный город
      }
    }, { debounce: 300 });
  },
});
```

---

## Пример 4: Форма регистрации с async валидацией

```typescript
interface RegistrationForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

const form = createForm<RegistrationForm>({
  form: {
    username: { value: '', component: Input },
    email: { value: '', component: Input },
    password: { value: '', component: PasswordInput },
    confirmPassword: { value: '', component: PasswordInput },
    acceptTerms: { value: false, component: Checkbox },
  },

  validation: (path) => {
    // Username
    required(path.username);
    minLength(path.username, 3);
    validators.validateAsync(path.username, async (value, opts) => {
      const { exists } = await api.checkUsername(value, opts?.signal);
      return exists ? { code: 'taken', message: 'Имя занято' } : null;
    }, { debounce: 500 });

    // Email
    required(path.email);
    email(path.email);
    validators.validateAsync(path.email, async (value, opts) => {
      const { exists } = await api.checkEmail(value, opts?.signal);
      return exists ? { code: 'taken', message: 'Email занят' } : null;
    }, { debounce: 500 });

    // Password
    required(path.password);
    minLength(path.password, 8);
    pattern(path.password, /[A-Z]/, { message: 'Нужна заглавная буква' });
    pattern(path.password, /[0-9]/, { message: 'Нужна цифра' });

    // Confirm
    required(path.confirmPassword);
    validators.validate(path.confirmPassword, (value, ctx) =>
      value !== ctx.form.password.value.value
        ? { code: 'mismatch', message: 'Пароли не совпадают' }
        : null
    );

    // Terms
    validators.validate(path.acceptTerms, (value) =>
      !value ? { code: 'required', message: 'Примите условия' } : null
    );
  },

  behavior: (path) => {
    // Перевалидировать confirmPassword при изменении password
    revalidateWhen(path.confirmPassword, [path.password]);
  },
});
```

---

## Пример 5: Динамический массив (ArrayNode)

```typescript
interface InvoiceForm {
  client: string;
  items: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
  total: number;
}

const form = createForm<InvoiceForm>({
  form: {
    client: { value: '', component: Input },
    items: {
      value: [{ description: '', quantity: 1, price: 0 }],
      itemSchema: {
        description: { value: '', component: Input },
        quantity: { value: 1, component: NumberInput },
        price: { value: 0, component: NumberInput },
      },
    },
    total: { value: 0, component: NumberInput, componentProps: { disabled: true } },
  },

  behavior: (path) => {
    // Автоматический расчёт total
    computeFrom(
      [path.items],
      path.total,
      (v) => v.items.reduce((sum, item) => sum + item.quantity * item.price, 0)
    );
  },
});

// Использование в React
function InvoiceFormComponent() {
  return (
    <div>
      <input {...bindInput(form.client)} />

      {form.items.map((item, index) => (
        <div key={index}>
          <input {...bindInput(item.description)} />
          <input {...bindInput(item.quantity)} type="number" />
          <input {...bindInput(item.price)} type="number" />
          <button onClick={() => form.items.remove(index)}>Удалить</button>
        </div>
      ))}

      <button onClick={() => form.items.push({ description: '', quantity: 1, price: 0 })}>
        Добавить позицию
      </button>

      <div>Итого: {form.total.value.value}</div>
    </div>
  );
}
```

---

## Пример 6: Многошаговая форма

```typescript
interface WizardForm {
  // Шаг 1: Личные данные
  personal: {
    firstName: string;
    lastName: string;
    email: string;
  };
  // Шаг 2: Адрес
  address: {
    country: string;
    city: string;
    street: string;
  };
  // Шаг 3: Оплата
  payment: {
    cardNumber: string;
    expiry: string;
    cvv: string;
  };
}

const form = createForm<WizardForm>({
  form: {
    personal: {
      firstName: { value: '', component: Input },
      lastName: { value: '', component: Input },
      email: { value: '', component: Input },
    },
    address: {
      country: { value: '', component: Select },
      city: { value: '', component: Select },
      street: { value: '', component: Input },
    },
    payment: {
      cardNumber: { value: '', component: CardInput },
      expiry: { value: '', component: Input },
      cvv: { value: '', component: Input },
    },
  },
  // ... validation
});

// Валидация по шагам
async function validateStep(step: number): Promise<boolean> {
  switch (step) {
    case 1:
      await form.personal.validate();
      return form.personal.valid.value;
    case 2:
      await form.address.validate();
      return form.address.valid.value;
    case 3:
      await form.payment.validate();
      return form.payment.valid.value;
  }
  return false;
}
```

---

## Связанные документы

- [Архитектура](architecture.md)
- [Signals и реактивность](signals.md)
- [Система Behaviors](behaviors.md)
- [Валидация](validation.md)
- [Типобезопасность](type-safety.md)
